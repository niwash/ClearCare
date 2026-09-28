"""Test doubles and sample payloads for snapshot tests."""

from datetime import UTC, datetime

from clearcare_pipeline.snapshots.fetch import FetchError, FetchResult

CSV_TYPE = "text/csv; charset=utf-8"
XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
REGISTER_CSV = b"Centre_ID,Centre_Title\n34,Elm Hall Nursing Home\n"
SECTION_64_XLSX = b"PK\x03\x04 rest of a workbook"
FIXED_TIME = datetime(2026, 9, 28, 6, 0, tzinfo=UTC)


def fixed_now() -> datetime:
    return FIXED_TIME


def no_sleep(_seconds: float) -> None:
    return None


def ok(body: bytes, content_type: str) -> FetchResult:
    return FetchResult(
        status=200,
        content_type=content_type,
        body=body,
        last_modified="Mon, 28 Sep 2026 06:00:00 GMT",
        etag='"1"',
    )


def failed(status: int) -> FetchResult:
    return FetchResult(
        status=status,
        content_type="text/html",
        body=b"<html>Browser Verification</html>",
        last_modified=None,
        etag=None,
    )


class FakeFetcher:
    """Returns queued outcomes per URL and records every call."""

    def __init__(
        self, outcomes: dict[str, list[FetchResult | FetchError]]
    ) -> None:
        self._outcomes = {url: list(queue) for url, queue in outcomes.items()}
        self.calls: list[str] = []

    def fetch(self, url: str) -> FetchResult:
        self.calls.append(url)
        outcome = self._outcomes[url].pop(0)
        if isinstance(outcome, FetchError):
            raise outcome
        return outcome
