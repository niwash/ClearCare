"""Asking Google's Geocoding API where a centre is, and checking its answer.

What is kept of an answer, and for how long: ADR-0027.
"""

import json
import math
import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from urllib.parse import urlencode

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from clearcare_pipeline.snapshots.fetch import Fetcher, FetchError

ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json"
TIMEOUT_SECONDS = 10.0
RETRIES = 3
# Before the first retry; each later retry waits twice as long as the last.
FIRST_PAUSE_SECONDS = 1.0

# Google could not answer this time, and the same request may work later.
_TRANSIENT_STATUSES = frozenset({"OVER_QUERY_LIMIT", "UNKNOWN_ERROR"})
# The key or the request is wrong, so every other centre would fail the same
# way. Google's documentation gives OVER_DAILY_LIMIT for a missing or invalid
# key and for billing that is off, as well as for a usage cap.
_REFUSED_STATUSES = frozenset(
    {"REQUEST_DENIED", "INVALID_REQUEST", "OVER_DAILY_LIMIT"}
)
# Google may write the county with either prefix; the register writes "Cork".
_COUNTY_PREFIX = re.compile(r"^(?:county|co\.?)\s+", re.IGNORECASE)


class _Google(BaseModel):
    # Strict, so that a number sent as text is not taken for one. Google's
    # other fields are left out, as nothing else from it is kept.
    model_config = ConfigDict(strict=True, extra="ignore")


class _Component(_Google):
    long_name: str
    short_name: str
    types: list[str]


class _LatLng(_Google):
    lat: float
    lng: float


class _Geometry(_Google):
    location: _LatLng | None = None


class _Result(_Google):
    address_components: list[_Component]
    geometry: _Geometry | None = None
    partial_match: bool = False
    place_id: str = Field(min_length=1)


class _Answer(_Google):
    status: str
    # Empty, but present, when the status is not OK.
    results: list[_Result]


@dataclass(frozen=True)
class Centre:
    """A centre in the served register snapshot, as Google is asked for it."""

    centre_id: str
    address: str
    county: str
    # As register_entry stores it, upper case with no space; None for a centre
    # whose register address ends without one.
    eircode: str | None


@dataclass(frozen=True)
class Location:
    """All that is kept of an accepted answer: its point and place_id."""

    latitude: float
    longitude: float
    place_id: str


@dataclass(frozen=True)
class Unresolved:
    """Why a centre has no new point, as one word for the log."""

    reason: str
    # False when Google never answered, which leaves the run incomplete.
    reached: bool = True


class RequestRefusedError(Exception):
    """Google refused the key or the request, so no centre can be geocoded."""


class GoogleGeocoder:
    """Geocodes one centre at a time, and counts the requests it sends."""

    def __init__(
        self, key: str, fetcher: Fetcher, sleep: Callable[[float], None]
    ) -> None:
        """Creates a geocoder that sends the key with each request."""
        self._key = key
        self._fetcher = fetcher
        self._sleep = sleep
        self.requests = 0

    def locate(self, centre: Centre) -> Location | Unresolved:
        """Returns the centre's location, or why Google gave none.

        Raises:
            RequestRefusedError: If Google refused the key or the request, or
                answered with an HTTP status that is neither 200 nor 5xx.
        """
        # The URL holds the key, so it is never logged or put in an error.
        url = _request_url(centre, self._key)
        for retry in range(RETRIES + 1):
            if retry > 0:
                self._sleep(FIRST_PAUSE_SECONDS * 2 ** (retry - 1))
            self.requests += 1
            try:
                result = self._fetcher.fetch(url)
            except FetchError:
                continue
            if result.status >= 500:
                continue
            if result.status != 200:
                raise RequestRefusedError(f"HTTP status {result.status}")
            try:
                answer = _Answer.model_validate(json.loads(result.body))
            except (ValueError, ValidationError):
                return Unresolved("malformed")
            if answer.status in _TRANSIENT_STATUSES:
                continue
            if answer.status in _REFUSED_STATUSES:
                raise RequestRefusedError(answer.status)
            return _accept(answer, centre)
        return Unresolved("unreachable", reached=False)


def _county_matches(components: Sequence[_Component], county: str) -> bool:
    """Whether Google's answer is in the register's county.

    Google names a country's first subdivision administrative_area_level_1.
    Its address data for Ireland makes that the county and spells it
    "Co. Cork" (chromium-i18n.appspot.com/ssl-address/data/IE), and its
    short names follow ISO 3166-2, which spells it "Cork". The register
    writes "Cork". Either name of the component may carry the county.
    """
    return any(
        "administrative_area_level_1" in component.types
        and _COUNTY_PREFIX.sub("", name).casefold() == county.casefold()
        for component in components
        for name in (component.long_name, component.short_name)
    )


def _request_url(centre: Centre, key: str) -> str:
    address = (
        # Written as Google's and Eircode's own example, "A65 F4E2".
        f"{centre.eircode[:3]} {centre.eircode[3:]}"
        if centre.eircode is not None
        else centre.address
    )
    query = urlencode(
        {"address": address, "components": "country:IE", "key": key}
    )
    return f"{ENDPOINT}?{query}"


def _accept(answer: _Answer, centre: Centre) -> Location | Unresolved:
    """Applies the rules an answer must pass before its point is stored."""
    if answer.status == "ZERO_RESULTS":
        return Unresolved("zero_results")
    if answer.status != "OK":
        return Unresolved("status")
    if not answer.results:
        return Unresolved("malformed")
    first = answer.results[0]
    if first.partial_match:
        return Unresolved("partial")
    location = first.geometry.location if first.geometry else None
    if location is None or not (
        math.isfinite(location.lat) and math.isfinite(location.lng)
    ):
        return Unresolved("location")
    if centre.eircode is not None:
        if not _eircode_matches(first.address_components, centre.eircode):
            return Unresolved("eircode")
    elif not _county_matches(first.address_components, centre.county):
        return Unresolved("county")
    return Location(location.lat, location.lng, first.place_id)


def _eircode_matches(components: Sequence[_Component], eircode: str) -> bool:
    return any(
        "postal_code" in component.types
        and _compact(component.long_name) == _compact(eircode)
        for component in components
    )


def _compact(eircode: str) -> str:
    return "".join(eircode.split()).upper()
