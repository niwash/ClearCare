"""Downloading every report listed on each centre's page."""

import dataclasses
import logging
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from clearcare_pipeline.raw_store import RawStore
from clearcare_pipeline.reports.centre_page import (
    CentrePage,
    CentrePageError,
    Report,
    parse_centre_page,
)
from clearcare_pipeline.reports.manifest import (
    CentreRecord,
    append_record,
    stored_report_files,
)
from clearcare_pipeline.reports.register import RegisteredCentre
from clearcare_pipeline.snapshots.fetch import Fetcher, FetchError, FetchResult

PDF_SIGNATURE = b"%PDF"
NOT_TRIED = "not tried: the run stopped"
# We have not seen HIQA's browser verification page on the routes we use, so
# an error response is taken for one when it carries the words such pages do.
_VERIFICATION_WORDS = (b"verification", b"captcha")

logger = logging.getLogger(__name__)


class SpacedFetcher:
    """Wraps a fetcher so each request starts a gap after the last ended."""

    def __init__(
        self,
        fetcher: Fetcher,
        gap_seconds: float,
        clock: Callable[[], float],
        sleep: Callable[[float], None],
    ) -> None:
        """Creates a fetcher that waits gap_seconds between requests.

        Args:
            fetcher: Makes the requests.
            gap_seconds: Minimum time from the end of one request to the
                start of the next, including failed requests.
            clock: Monotonic clock in seconds.
            sleep: Waits the given number of seconds.
        """
        self._fetcher = fetcher
        self._gap = gap_seconds
        self._clock = clock
        self._sleep = sleep
        self._last_ended: float | None = None

    def fetch(self, url: str) -> FetchResult:
        """Waits out the gap, then returns the wrapped fetcher's result."""
        if self._last_ended is not None:
            wait = self._last_ended + self._gap - self._clock()
            if wait > 0:
                self._sleep(wait)
        try:
            return self._fetcher.fetch(url)
        finally:
            self._last_ended = self._clock()


@dataclass(frozen=True)
class DownloadSummary:
    """What one run did. A run stops at the first file it cannot get."""

    centres: int
    reports_listed: int
    downloaded: int
    already_stored: int
    downloaded_bytes: int
    failure: str | None


class _TemporaryError(Exception):
    """A failure worth another attempt: no response, HTTP 429 or a 5xx."""


class _StopError(Exception):
    """A failure that stops the run at once, such as a verification page."""


def download_reports(
    centres: Sequence[RegisteredCentre],
    fetcher: Fetcher,
    store: RawStore,
    manifest: Path,
    now: Callable[[], datetime],
    sleep: Callable[[float], None],
    waits: Sequence[float],
) -> DownloadSummary:
    """Downloads the reports of each centre that are not stored yet.

    Each centre's record is appended to the manifest as soon as the centre
    is done. A temporary failure is retried after each of the waits. Any
    other failure, or one still there after the last wait, stops the run.
    """
    stored = stored_report_files(manifest)
    records: list[CentreRecord] = []
    downloads: list[Report] = []
    failure = None
    for centre in centres:
        record, new = _download_centre(
            centre, fetcher, store, stored, now, sleep, waits
        )
        append_record(manifest, record)
        records.append(record)
        downloads.extend(new)
        stored = {**stored, **{report.file_name: report for report in new}}
        failure = _failure(record)
        if failure is not None:
            logger.error("%s", failure)
            break
        logger.info(
            "centre %s: %d reports listed, %d downloaded",
            centre.centre_id,
            len(record.reports),
            len(new),
        )
    reports = [report for record in records for report in record.reports]
    # A report with a stored copy was either downloaded in this run or
    # already stored, including by an earlier centre in this run.
    with_copy = sum(report.sha256 is not None for report in reports)
    return DownloadSummary(
        centres=len(records),
        reports_listed=len(reports),
        downloaded=len(downloads),
        already_stored=with_copy - len(downloads),
        downloaded_bytes=sum(report.size or 0 for report in downloads),
        failure=failure,
    )


def _download_centre(
    centre: RegisteredCentre,
    fetcher: Fetcher,
    store: RawStore,
    stored: Mapping[str, Report],
    now: Callable[[], datetime],
    sleep: Callable[[float], None],
    waits: Sequence[float],
) -> tuple[CentreRecord, tuple[Report, ...]]:
    """Returns the centre's record and the reports downloaded for it."""
    record = CentreRecord(
        centre_id=centre.centre_id,
        url=centre.url,
        fetched_at=_timestamp(now),
        page_sha256=None,
        reports=(),
        error=None,
    )
    try:
        body, page = _fetch(fetcher, centre.url, _read_page, sleep, waits)
    except _StopError as error:
        return dataclasses.replace(record, error=str(error)), ()
    record = dataclasses.replace(record, page_sha256=store.put(body))
    if page.centre_id != centre.centre_id:
        error = f"the page is for centre {page.centre_id}"
        return dataclasses.replace(record, error=error), ()
    known = dict(stored)
    reports: list[Report] = []
    new: list[Report] = []
    for listed in page.reports:
        copy = known.get(listed.file_name)
        if reports and reports[-1].error is not None:
            report = dataclasses.replace(listed, error=NOT_TRIED)
        elif copy is not None:
            report = dataclasses.replace(
                listed,
                sha256=copy.sha256,
                size=copy.size,
                fetched_at=copy.fetched_at,
            )
        else:
            report = _download_report(listed, fetcher, store, now, sleep, waits)
            if report.error is None:
                new.append(report)
                known[report.file_name] = report
        reports.append(report)
    return dataclasses.replace(record, reports=tuple(reports)), tuple(new)


def _download_report(
    listed: Report,
    fetcher: Fetcher,
    store: RawStore,
    now: Callable[[], datetime],
    sleep: Callable[[float], None],
    waits: Sequence[float],
) -> Report:
    try:
        body = _fetch(fetcher, listed.url, _read_pdf, sleep, waits)
    except _StopError as error:
        return dataclasses.replace(listed, error=str(error))
    return dataclasses.replace(
        listed,
        sha256=store.put(body),
        size=len(body),
        fetched_at=_timestamp(now),
    )


def _timestamp(now: Callable[[], datetime]) -> str:
    return now().isoformat(timespec="seconds")


def _failure(record: CentreRecord) -> str | None:
    if record.error is not None:
        return f"centre {record.centre_id}: {record.error}"
    for report in record.reports:
        if report.error is not None:
            return (
                f"centre {record.centre_id}: {report.file_name}: {report.error}"
            )
    return None


def _fetch[T](
    fetcher: Fetcher,
    url: str,
    read: Callable[[FetchResult], T],
    sleep: Callable[[float], None],
    waits: Sequence[float],
) -> T:
    """Fetches the URL and reads the response, retrying temporary failures.

    Raises:
        _StopError: If a failure is not temporary, or is still there after
            the last wait.
    """
    problem = ""
    for attempt, wait in enumerate((*waits, None), start=1):
        try:
            return read(_ok_response(fetcher, url))
        except _TemporaryError as error:
            problem = str(error)
        if wait is None:
            break
        logger.warning(
            "%s: attempt %d failed (%s); retrying in %.0f s",
            url,
            attempt,
            problem,
            wait,
        )
        sleep(wait)
    raise _StopError(problem)


def _ok_response(fetcher: Fetcher, url: str) -> FetchResult:
    try:
        result = fetcher.fetch(url)
    except FetchError as error:
        raise _TemporaryError(f"fetch failed: {error}") from error
    if result.status == 200:
        return result
    if any(word in result.body.lower() for word in _VERIFICATION_WORDS):
        raise _StopError(f"browser verification page (HTTP {result.status})")
    if result.status == 429 or result.status >= 500:
        raise _TemporaryError(f"HTTP {result.status}")
    if 300 <= result.status < 400:
        raise _StopError(f"HTTP {result.status}: redirect not followed")
    raise _StopError(f"HTTP {result.status}")


def _read_page(result: FetchResult) -> tuple[bytes, CentrePage]:
    try:
        return result.body, parse_centre_page(result.body.decode("utf-8"))
    except (UnicodeDecodeError, CentrePageError) as error:
        raise _StopError(f"unreadable centre page ({error})") from error


def _read_pdf(result: FetchResult) -> bytes:
    if not result.body.startswith(PDF_SIGNATURE):
        content_type = result.content_type or "no content type"
        raise _StopError(f"not a PDF ({content_type})")
    return result.body
