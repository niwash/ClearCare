from dataclasses import replace
from pathlib import Path

import pytest

from clearcare_pipeline.reports.centre_page import Report
from clearcare_pipeline.reports.manifest import (
    CentreRecord,
    ManifestError,
    append_record,
    last_page_checks,
    stored_report_files,
)


def _report(file_name: str, sha256: str | None) -> Report:
    listed = Report(
        inspection_date="2026-04-10",
        report_type="Nursing Homes",
        published_date="2026-08-27",
        file_name=file_name,
        url="https://www.hiqa.ie/system/files/inspectionreports/" + file_name,
    )
    if sha256 is None:
        return replace(listed, error="HTTP 503")
    return replace(
        listed, sha256=sha256, size=100, fetched_at="2026-10-02T09:00:00+00:00"
    )


def _record(*reports: Report) -> CentreRecord:
    return CentreRecord(
        centre_id="34",
        url="https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall",
        fetched_at="2026-10-02T09:00:00+00:00",
        page_sha256="abc",
        reports=reports,
        error=None,
    )


def test_no_manifest_means_nothing_is_stored(tmp_path: Path) -> None:
    assert stored_report_files(tmp_path / "inspection-reports.jsonl") == {}


def test_only_reports_with_a_stored_copy_count(tmp_path: Path) -> None:
    manifest = tmp_path / "inspection-reports.jsonl"
    stored = _report("a.pdf", "aaa")
    append_record(manifest, _record(stored, _report("b.pdf", None)))

    assert stored_report_files(manifest) == {"a.pdf": stored}


def test_unreadable_line_is_an_error(tmp_path: Path) -> None:
    manifest = tmp_path / "inspection-reports.jsonl"
    manifest.write_text('{"centre_id": "34"}\n')

    with pytest.raises(ManifestError, match="line 1"):
        stored_report_files(manifest)


def test_each_centres_last_page_read_is_its_check(tmp_path: Path) -> None:
    manifest = tmp_path / "inspection-reports.jsonl"
    append_record(manifest, _record(_report("a.pdf", "aaa")))
    # A report download that failed doesn't matter: the page was read.
    later = replace(
        _record(_report("b.pdf", None)), fetched_at="2026-10-03T09:00:00+00:00"
    )
    append_record(manifest, later)

    assert last_page_checks(manifest) == {"34": "2026-10-03T09:00:00+00:00"}


def test_a_page_read_that_failed_leaves_the_last_one_that_worked(
    tmp_path: Path,
) -> None:
    manifest = tmp_path / "inspection-reports.jsonl"
    append_record(manifest, _record())
    failed = replace(
        _record(), fetched_at="2026-10-03T09:00:00+00:00", error="HTTP 503"
    )
    append_record(manifest, failed)

    assert last_page_checks(manifest) == {"34": "2026-10-02T09:00:00+00:00"}


def test_a_page_read_that_never_worked_is_not_a_check(tmp_path: Path) -> None:
    manifest = tmp_path / "inspection-reports.jsonl"
    append_record(manifest, replace(_record(), error="HTTP 503"))

    assert last_page_checks(manifest) == {}
