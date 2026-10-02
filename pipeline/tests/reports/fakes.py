"""Test doubles for report download tests."""

from collections.abc import Callable
from datetime import UTC, datetime

from clearcare_pipeline.snapshots.fetch import FetchResult


class FakeClock:
    """A monotonic clock that only moves when something sleeps or works."""

    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


def at(hour: int) -> Callable[[], datetime]:
    return lambda: datetime(2026, 10, 2, hour, 0, tzinfo=UTC)


def html(body: bytes, status: int = 200) -> FetchResult:
    return FetchResult(
        status=status,
        content_type="text/html; charset=utf-8",
        body=body,
        last_modified=None,
        etag=None,
    )


def pdf(body: bytes) -> FetchResult:
    return FetchResult(
        status=200,
        content_type="application/pdf",
        body=body,
        last_modified="Fri, 14 Aug 2026 11:01:42 GMT",
        etag=None,
    )


VERIFICATION = html(b"<html><h1>Browser Verification</h1></html>", 503)
UNAVAILABLE = html(b"<html><h1>503 Service Unavailable</h1></html>", 503)
REDIRECT = html(b"", 302)
