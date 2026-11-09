"""A fake Geocoding API, and answers shaped like Google's documented JSON."""

import json
from collections.abc import Mapping, Sequence
from urllib.parse import parse_qs, urlsplit

from clearcare_pipeline.snapshots.fetch import FetchError, FetchResult

Answer = FetchResult | FetchError


class FakeGoogle:
    """Answers each request by its address, in order, and records the query."""

    def __init__(self, answers: Mapping[str, Sequence[Answer]]) -> None:
        self._answers = {
            address: list(queue) for address, queue in answers.items()
        }
        self.queries: list[dict[str, str]] = []

    @property
    def addresses(self) -> list[str]:
        return [query["address"] for query in self.queries]

    def fetch(self, url: str) -> FetchResult:
        query = {
            name: values[0]
            for name, values in parse_qs(urlsplit(url).query).items()
        }
        self.queries.append(query)
        answer = self._answers[query["address"]].pop(0)
        if isinstance(answer, FetchError):
            # urllib's messages can carry the URL, and so the key with it, so
            # the fake's do too.
            raise FetchError(f"{answer}: {url}")
        return answer


def found(
    *,
    latitude: float = 53.2707,
    longitude: float = -9.0568,
    postal_code: str = "A65 F4E2",
    county: str = "County Galway",
    place_id: str | None = "ChIJ-fake-place",
    partial_match: bool = False,
    location: bool = True,
) -> FetchResult:
    """An OK answer whose first result has these parts; None leaves one out."""
    result: dict[str, object] = {
        "address_components": [
            {
                "long_name": postal_code,
                "short_name": postal_code,
                "types": ["postal_code"],
            },
            {
                "long_name": county,
                "short_name": county,
                "types": ["administrative_area_level_1", "political"],
            },
            {
                "long_name": "Ireland",
                "short_name": "IE",
                "types": ["country", "political"],
            },
        ],
        "formatted_address": "Formatted Street, Somewhere, Ireland",
        "geometry": {"location_type": "ROOFTOP"},
        "types": ["street_address"],
    }
    if place_id is not None:
        result["place_id"] = place_id
    if location:
        result["geometry"] = {
            "location": {"lat": latitude, "lng": longitude},
            "location_type": "ROOFTOP",
        }
    if partial_match:
        result["partial_match"] = True
    return _json({"results": [result], "status": "OK"})


def status(name: str, *, results: bool = True) -> FetchResult:
    """An answer with no results, as Google sends for every status but OK.

    With results False the empty results list is left out as well.
    """
    body: dict[str, object] = {
        "error_message": "Formatted Street is not a message to log.",
        "status": name,
    }
    if results:
        body["results"] = []
    return _json(body)


def http(code: int) -> FetchResult:
    """An answer with this status and an HTML page, not JSON, for a body."""
    return FetchResult(
        status=code,
        content_type="text/html",
        body=b"<html>Server Error</html>",
        last_modified=None,
        etag=None,
    )


def _json(body: Mapping[str, object]) -> FetchResult:
    return FetchResult(
        status=200,
        content_type="application/json; charset=UTF-8",
        body=json.dumps(body).encode(),
        last_modified=None,
        etag=None,
    )
