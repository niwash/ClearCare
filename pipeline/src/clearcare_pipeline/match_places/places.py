"""Asking Google's Places API which listing belongs to a centre (ADR-0030).

The search is by name. Searching the businesses within a circle around the
centre's point was measured as well: it cannot return a namesake in another
town, but it surfaces wrong-but-nearby businesses that a name query never ranks
first - a marina, a neighbouring hospital unit - and it approves five fewer
homes with more than twice the error rate (CCARE-209's proposal).
"""

import json
import time
import urllib.error
import urllib.request
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from clearcare_pipeline.snapshots.fetch import FetchError, FetchResult

ENDPOINT = "https://places.googleapis.com/v1/places:searchText"
TIMEOUT_SECONDS = 10.0
RETRIES = 3
# Before the first retry; each later retry waits twice as long as the last.
FIRST_PAUSE_SECONDS = 1.0
# A home, a duplicate listing of it, and a neighbour or two. Five is the most
# that is useful; the best is chosen by name, not by order.
PAGE_SIZE = 5

# id and displayName decide the match, location measures it, photos is the
# fourth condition. Asking for less would not answer the question.
FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.location",
        "places.photos",
    ]
)


class _Google(BaseModel):
    # Strict, so that a number sent as text is not taken for one.
    model_config = ConfigDict(strict=True, extra="ignore")


class _DisplayName(_Google):
    text: str


class _LatLng(_Google):
    latitude: float
    longitude: float


class _Photo(_Google):
    name: str = Field(min_length=1)


class _Place(_Google):
    id: str = Field(min_length=1)
    display_name: _DisplayName = Field(alias="displayName")
    location: _LatLng | None = None
    # Absent, not empty, for a place Google holds no photo of.
    photos: list[_Photo] = []


class _Answer(_Google):
    # Absent, not empty, when the search matched nothing.
    places: list[_Place] = []


@dataclass(frozen=True)
class Centre:
    """A served centre, as Google is asked about it."""

    centre_id: str
    name: str
    address: str
    county: str
    latitude: float
    longitude: float


@dataclass(frozen=True)
class Candidate:
    """One listing Google offered for the centre."""

    place_id: str
    name: str
    latitude: float
    longitude: float
    photo_count: int


@dataclass(frozen=True)
class Unresolved:
    """Why a centre has no listing to choose from, as one word for the log."""

    reason: str
    # False when Google never answered, which leaves the run incomplete.
    reached: bool = True


class RequestRefusedError(Exception):
    """Google refused the key or the request, so no centre can be matched."""


class Transport(Protocol):
    """Posts one request and returns what the server answered."""

    def post(
        self, url: str, headers: Mapping[str, str], body: bytes
    ) -> FetchResult:
        """Returns the response, whatever its status."""
        ...


class UrllibTransport:
    """Transport built on the standard library."""

    def post(
        self, url: str, headers: Mapping[str, str], body: bytes
    ) -> FetchResult:
        """Posts the body, and returns a refusal rather than raising it."""
        request = urllib.request.Request(
            url, data=body, headers=dict(headers), method="POST"
        )
        try:
            with urllib.request.urlopen(
                request, timeout=TIMEOUT_SECONDS
            ) as response:
                return FetchResult(
                    status=response.status,
                    content_type=response.headers.get("Content-Type"),
                    body=response.read(),
                    last_modified=None,
                    etag=None,
                )
        except urllib.error.HTTPError as failure:
            # The body says why; the caller decides whether to stop.
            return FetchResult(
                status=failure.code,
                content_type=failure.headers.get("Content-Type"),
                body=failure.read() or b"",
                last_modified=None,
                etag=None,
            )


class PlacesClient:
    """Asks Google for the listings that might be one centre."""

    def __init__(
        self,
        key: str,
        transport: Transport,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        """Creates a client that sends the key with each request."""
        self._key = key
        self._transport = transport
        self._sleep = sleep
        self.requests = 0

    def candidates(self, centre: Centre) -> list[Candidate] | Unresolved:
        """Returns the listings Google offered, or why it offered none.

        Raises:
            RequestRefusedError: If Google refused the key or the request, or
                answered with an HTTP status other than 200, 429 or 5xx.
        """
        # The key travels in a header, so it is never part of the URL, the
        # log, or an error message.
        body = json.dumps(
            {
                "textQuery": query(centre),
                "regionCode": "IE",
                "pageSize": PAGE_SIZE,
            }
        ).encode()
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self._key,
            "X-Goog-FieldMask": FIELD_MASK,
        }
        for retry in range(RETRIES + 1):
            if retry > 0:
                self._sleep(FIRST_PAUSE_SECONDS * 2 ** (retry - 1))
            self.requests += 1
            try:
                result = self._transport.post(ENDPOINT, headers, body)
            except FetchError:
                continue
            # Too Many Requests, like a server error, may pass.
            if result.status == 429 or result.status >= 500:
                continue
            if result.status != 200:
                raise RequestRefusedError(f"HTTP status {result.status}")
            return _parse(result.body)
        return Unresolved("unreachable", reached=False)


def query(centre: Centre) -> str:
    """The text Google is asked to find the centre by.

    The register address ends in the Eircode, which narrows the country to one
    street. The county is not sent: it was measured and changed almost nothing.
    """
    return f"{centre.name}, {centre.address}, Ireland"


def _parse(body: bytes) -> list[Candidate] | Unresolved:
    """Reads Google's answer into candidates, or says why it could not."""
    try:
        answer = _Answer.model_validate(json.loads(body))
    except (ValueError, ValidationError):
        return Unresolved("malformed")
    if not answer.places:
        return []
    found = [
        Candidate(
            place_id=place.id,
            name=place.display_name.text,
            latitude=place.location.latitude,
            longitude=place.location.longitude,
            photo_count=len(place.photos),
        )
        for place in answer.places
        if place.location is not None
    ]
    # A listing with no point cannot be measured against the centre's, so it
    # is no use even if its name is perfect.
    return found or Unresolved("no_location")
