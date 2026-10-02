import json
from pathlib import Path
from typing import Any

import pytest

from clearcare_pipeline.raw_store import FileSystemRawStore
from clearcare_pipeline.reports.download import (
    DownloadSummary,
    SpacedFetcher,
    download_reports,
)
from clearcare_pipeline.reports.register import RegisteredCentre
from clearcare_pipeline.snapshots.fetch import FetchError, FetchResult
from tests.reports.fakes import (
    REDIRECT,
    UNAVAILABLE,
    VERIFICATION,
    FakeClock,
    at,
    html,
    pdf,
)
from tests.snapshots.fakes import FakeFetcher, no_sleep

PAGE = (Path(__file__).parent / "fixtures" / "centre-34.html").read_bytes()
ELM_HALL = RegisteredCentre(
    centre_id="34",
    url="https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall-nursing-home",
)
REPORTS = "https://www.hiqa.ie/system/files/inspectionreports/"
PDF_URLS = (
    REPORTS + "34-elm-hall-nursing-home-10-april-2026.pdf",
    REPORTS + "34-elm-hall-nursing-home-25-june-2025.pdf",
    REPORTS + "34-elm-hall-nursing-home-29-august-2024.pdf",
    REPORTS + "34-elm-hall-nursing-home-05-march-2024.pdf",
)
WAITS = (60.0, 300.0)
Outcomes = dict[str, list[FetchResult | FetchError]]


def _outcomes() -> Outcomes:
    return {
        ELM_HALL.url: [html(PAGE)],
        **{
            url: [pdf(b"%PDF-1.7 report " + str(n).encode())]
            for n, url in enumerate(PDF_URLS)
        },
    }


def _read(manifest: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in manifest.read_text().splitlines()]


def _run(
    tmp_path: Path,
    outcomes: Outcomes,
    centres: tuple[RegisteredCentre, ...] = (ELM_HALL,),
    sleeps: list[float] | None = None,
    hour: int = 9,
) -> tuple[DownloadSummary, FakeFetcher]:
    fetcher = FakeFetcher(outcomes)
    summary = download_reports(
        centres,
        fetcher,
        FileSystemRawStore(tmp_path / "raw"),
        tmp_path / "inspection-reports.jsonl",
        at(hour),
        no_sleep if sleeps is None else sleeps.append,
        WAITS,
    )
    return summary, fetcher


def test_downloads_every_listed_report(tmp_path: Path) -> None:
    summary, _ = _run(tmp_path, _outcomes())

    record = _read(tmp_path / "inspection-reports.jsonl")[0]
    first = record["reports"][0]
    raw = FileSystemRawStore(tmp_path / "raw")
    assert summary == DownloadSummary(
        centres=1,
        reports_listed=4,
        downloaded=4,
        already_stored=0,
        downloaded_bytes=4 * len(b"%PDF-1.7 report 0"),
        failure=None,
    )
    assert record["centre_id"] == "34"
    assert record["fetched_at"] == "2026-10-02T09:00:00+00:00"
    assert raw.path_for(record["page_sha256"]).read_bytes() == PAGE
    assert first == {
        "inspection_date": "2026-04-10",
        "report_type": "Nursing Homes",
        "published_date": "2026-08-27",
        "file_name": "34-elm-hall-nursing-home-10-april-2026.pdf",
        "url": PDF_URLS[0],
        "sha256": first["sha256"],
        "size": len(b"%PDF-1.7 report 0"),
        "fetched_at": "2026-10-02T09:00:00+00:00",
        "error": None,
    }
    assert raw.path_for(first["sha256"]).read_bytes() == b"%PDF-1.7 report 0"


def test_rerun_reuses_stored_reports_with_their_download_time(
    tmp_path: Path,
) -> None:
    _run(tmp_path, _outcomes(), hour=9)

    summary, rerun = _run(tmp_path, {ELM_HALL.url: [html(PAGE)]}, hour=15)

    first_run, second_run = _read(tmp_path / "inspection-reports.jsonl")
    assert rerun.calls == [ELM_HALL.url]
    assert (summary.downloaded, summary.already_stored) == (0, 4)
    assert summary.downloaded_bytes == 0
    assert second_run["fetched_at"] == "2026-10-02T15:00:00+00:00"
    assert second_run["reports"] == first_run["reports"]


def test_report_downloaded_earlier_in_the_run_is_not_requested_again(
    tmp_path: Path,
) -> None:
    # Two centre pages that list the same four files.
    twin = RegisteredCentre("35", "https://www.hiqa.ie/twin")
    twin_page = PAGE.replace(
        b'<div class="field-content">34</div>',
        b'<div class="field-content">35</div>',
    )
    outcomes: Outcomes = {**_outcomes(), twin.url: [html(twin_page)]}

    summary, fetcher = _run(tmp_path, outcomes, centres=(ELM_HALL, twin))

    assert summary.failure is None
    assert (summary.reports_listed, summary.downloaded) == (8, 4)
    assert summary.already_stored == 4
    assert all(fetcher.calls.count(url) == 1 for url in PDF_URLS)


def test_temporary_failure_is_retried_after_waiting(tmp_path: Path) -> None:
    outcomes = _outcomes()
    outcomes[PDF_URLS[1]] = [
        FetchError("connection reset"),
        *outcomes[PDF_URLS[1]],
    ]
    sleeps: list[float] = []

    summary, _ = _run(tmp_path, outcomes, sleeps=sleeps)

    assert summary.failure is None
    assert summary.downloaded == 4
    assert sleeps == [60.0]


def test_temporary_failure_on_every_attempt_stops_the_run(
    tmp_path: Path,
) -> None:
    other = RegisteredCentre("1", "https://www.hiqa.ie/aclare")
    sleeps: list[float] = []

    summary, fetcher = _run(
        tmp_path,
        {ELM_HALL.url: [UNAVAILABLE] * 3},
        centres=(ELM_HALL, other),
        sleeps=sleeps,
    )

    record = _read(tmp_path / "inspection-reports.jsonl")[0]
    assert summary.failure == "centre 34: HTTP 503"
    assert sleeps == [60.0, 300.0]
    assert record["error"] == "HTTP 503"
    assert record["page_sha256"] is None
    assert record["reports"] == []
    assert other.url not in fetcher.calls


def test_verification_page_stops_the_run_without_retrying(
    tmp_path: Path,
) -> None:
    outcomes = _outcomes()
    outcomes[PDF_URLS[1]] = [VERIFICATION]
    sleeps: list[float] = []

    summary, fetcher = _run(tmp_path, outcomes, sleeps=sleeps)

    reports = _read(tmp_path / "inspection-reports.jsonl")[0]["reports"]
    assert summary.failure == (
        "centre 34: 34-elm-hall-nursing-home-25-june-2025.pdf: "
        "browser verification page (HTTP 503)"
    )
    assert sleeps == []
    assert [report["error"] for report in reports] == [
        None,
        "browser verification page (HTTP 503)",
        "not tried: the run stopped",
        "not tried: the run stopped",
    ]
    assert PDF_URLS[2] not in fetcher.calls


@pytest.mark.parametrize(
    ("response", "problem"),
    [
        (REDIRECT, "HTTP 302: redirect not followed"),
        (html(b"<html>Sign in</html>"), "not a PDF (text/html; charset=utf-8)"),
        (html(b"Not found", 404), "HTTP 404"),
    ],
)
def test_response_that_is_not_a_pdf_stops_the_run_without_retrying(
    tmp_path: Path, response: FetchResult, problem: str
) -> None:
    outcomes = _outcomes()
    outcomes[PDF_URLS[0]] = [response]
    sleeps: list[float] = []

    summary, _ = _run(tmp_path, outcomes, sleeps=sleeps)

    assert summary.failure == (
        f"centre 34: 34-elm-hall-nursing-home-10-april-2026.pdf: {problem}"
    )
    assert sleeps == []


def test_unreadable_centre_page_stops_the_run_without_retrying(
    tmp_path: Path,
) -> None:
    sleeps: list[float] = []

    summary, _ = _run(
        tmp_path, {ELM_HALL.url: [html(b"<html>Hello</html>")]}, sleeps=sleeps
    )

    assert summary.failure == (
        "centre 34: unreadable centre page (no centre ID on the page)"
    )
    assert sleeps == []


def test_page_of_another_centre_stops_the_run(tmp_path: Path) -> None:
    centre = RegisteredCentre("1", ELM_HALL.url)

    summary, _ = _run(tmp_path, {ELM_HALL.url: [html(PAGE)]}, centres=(centre,))

    record = _read(tmp_path / "inspection-reports.jsonl")[0]
    assert summary.failure == "centre 1: the page is for centre 34"
    assert record["reports"] == []


class SlowFetcher:
    """Takes a second per request, or fails if told to."""

    def __init__(self, clock: FakeClock) -> None:
        self._clock = clock
        self.fail = False

    def fetch(self, url: str) -> FetchResult:
        self._clock.now += 1.0
        if self.fail:
            raise FetchError("connection reset")
        return pdf(b"%PDF-1.7")


def _spaced(clock: FakeClock) -> tuple[SpacedFetcher, SlowFetcher]:
    slow = SlowFetcher(clock)
    return SpacedFetcher(slow, 3.0, clock.monotonic, clock.sleep), slow


def test_first_request_does_not_wait() -> None:
    clock = FakeClock()
    fetcher, _ = _spaced(clock)

    fetcher.fetch("https://www.hiqa.ie/a")

    assert clock.sleeps == []


def test_next_request_starts_the_gap_after_the_last_one_ended() -> None:
    clock = FakeClock()
    fetcher, _ = _spaced(clock)

    fetcher.fetch("https://www.hiqa.ie/a")
    clock.now += 1.0
    fetcher.fetch("https://www.hiqa.ie/b")

    assert clock.sleeps == [2.0]


def test_no_wait_when_the_gap_has_already_passed() -> None:
    clock = FakeClock()
    fetcher, _ = _spaced(clock)

    fetcher.fetch("https://www.hiqa.ie/a")
    clock.now += 60.0
    fetcher.fetch("https://www.hiqa.ie/b")

    assert clock.sleeps == []


def test_failed_request_counts_as_a_request() -> None:
    clock = FakeClock()
    fetcher, slow = _spaced(clock)

    slow.fail = True
    with pytest.raises(FetchError):
        fetcher.fetch("https://www.hiqa.ie/a")
    slow.fail = False
    fetcher.fetch("https://www.hiqa.ie/a")

    assert clock.sleeps == [3.0]
