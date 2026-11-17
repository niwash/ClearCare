"""A fake Places API, and answers shaped like Google's documented JSON."""

import json
from collections.abc import Mapping, Sequence

from clearcare_pipeline.snapshots.fetch import FetchError, FetchResult

Answer = FetchResult | FetchError


class FakeTransport:
    """Answers each request from a queue, and records what was asked."""

    def __init__(self, answers: Sequence[Answer]) -> None:
        self._answers = list(answers)
        self.urls: list[str] = []
        self.headers: list[Mapping[str, str]] = []
        self.bodies: list[dict[str, object]] = []

    def post(
        self, url: str, headers: Mapping[str, str], body: bytes
    ) -> FetchResult:
        self.urls.append(url)
        self.headers.append(headers)
        self.bodies.append(json.loads(body))
        answer = self._answers.pop(0)
        if isinstance(answer, FetchError):
            raise answer
        return answer


def place(
    place_id: str,
    name: str,
    *,
    latitude: float = 53.0,
    longitude: float = -8.0,
    photos: int = 3,
) -> dict[str, object]:
    """One listing, as Google returns it, with the fields the mask asks for."""
    return {
        "id": place_id,
        "displayName": {"text": name},
        "location": {"latitude": latitude, "longitude": longitude},
        "photos": [
            {"name": f"places/{place_id}/photos/{number}"}
            for number in range(photos)
        ],
    }


def result(body: bytes, status: int = 200) -> FetchResult:
    """A response carrying the body as JSON."""
    return FetchResult(
        status=status,
        content_type="application/json",
        body=body,
        last_modified=None,
        etag=None,
    )


def answer(*places: dict[str, object], status: int = 200) -> FetchResult:
    """A 200 carrying the listings."""
    return result(json.dumps({"places": list(places)}).encode(), status)


def empty(status: int = 200) -> FetchResult:
    """A 200 that matched nothing: Google sends no places key at all."""
    return result(b"{}", status)


def malformed() -> FetchResult:
    """A 200 whose body is not the documented shape."""
    return result(b"not json")


def refusal(status: int) -> FetchResult:
    """A refusal, which the client must not mistake for a bad answer."""
    return result(b'{"error": {"code": %d}}' % status, status)


class FakeResult:
    """What psycopg's execute returns: the rows, and a row count."""

    def __init__(self, rows: Sequence[tuple[object, ...]] = ()) -> None:
        self._rows = list(rows)
        self.rowcount = len(self._rows)

    def fetchall(self) -> list[tuple[object, ...]]:
        return self._rows


class FakeConnection:
    """Stands in for psycopg: answers the due query and records the writes."""

    def __init__(self, rows: Sequence[tuple[object, ...]] = ()) -> None:
        self.rows = list(rows)
        self.writes: list[tuple[object, ...]] = []
        self.queries: list[str] = []

    def execute(self, query: str, params: Sequence[object] = ()) -> FakeResult:
        self.queries.append(query)
        if query.lstrip().upper().startswith("SELECT"):
            return FakeResult(self.rows)
        self.writes.append(tuple(params))
        return FakeResult()
