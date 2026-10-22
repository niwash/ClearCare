"""Test doubles for the ingest workflow."""

from collections.abc import Collection, Mapping, Sequence
from pathlib import Path

from clearcare_pipeline.ingest_reports.models import InspectionReport
from clearcare_pipeline.reports.centre_page import Report
from clearcare_pipeline.reports.manifest import (
    MANIFEST_NAME,
    CentreRecord,
    append_record,
)


def write_reports_manifest(
    data_dir: Path, files: Mapping[str, str | None]
) -> None:
    """Writes a reports manifest listing each file name with its sha256."""
    reports = tuple(
        Report(
            inspection_date="2026-04-10",
            report_type="Nursing Homes",
            published_date="2026-08-27",
            file_name=name,
            url=f"https://www.hiqa.ie/system/files/inspectionreports/{name}",
            sha256=sha256,
            fetched_at="2026-10-02T09:00:00+00:00" if sha256 else None,
        )
        for name, sha256 in files.items()
    )
    record = CentreRecord(
        centre_id="34",
        url="https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall",
        fetched_at="2026-10-02T09:00:00+00:00",
        page_sha256=None,
        reports=reports,
        error=None,
    )
    append_record(data_dir / "manifests" / MANIFEST_NAME, record)


class FakeCatalogue:
    """What the database holds, for a test to state.

    known_files is the set of hashes the store holds; None means every hash
    is found, so nothing is skipped for a missing file. known_centres is the
    set of centre ids the register holds; None means every centre is found.
    loaded_files is the set of hashes that already have a report.
    """

    def __init__(
        self,
        known_files: set[str] | None = None,
        known_centres: set[str] | None = None,
        loaded_files: Collection[str] = (),
    ) -> None:
        self._known_files = known_files
        self._known_centres = known_centres
        self._loaded_files = loaded_files

    def report_loaded(self, sha256: str) -> bool:
        return sha256 in self._loaded_files

    def source_file_id(self, sha256: str) -> int | None:
        if self._known_files is not None and sha256 not in self._known_files:
            return None
        return 1

    def centre_exists(self, centre_id: str) -> bool:
        return self._known_centres is None or centre_id in self._known_centres


class FakeReportWriter:
    """A report writer that keeps its batches in memory."""

    def __init__(self) -> None:
        self.batches: list[list[InspectionReport]] = []

    def write_batch(self, reports: Sequence[InspectionReport]) -> int:
        self.batches.append(list(reports))
        return len(reports)
