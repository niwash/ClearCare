"""Test doubles for the ingest workflow."""

from collections.abc import Sequence

from clearcare_pipeline.ingest_reports.models import InspectionReport


class FakeReportWriter:
    """A report writer that keeps its batches in memory.

    known_files is the set of hashes the store holds; None means every hash
    is found, so nothing is skipped for a missing file.
    """

    def __init__(self, known_files: set[str] | None = None) -> None:
        self._known_files = known_files
        self.batches: list[list[InspectionReport]] = []

    def source_file_id(self, sha256: str) -> int | None:
        if self._known_files is not None and sha256 not in self._known_files:
            return None
        return 1

    def write_batch(self, reports: Sequence[InspectionReport]) -> int:
        self.batches.append(list(reports))
        return len(reports)
