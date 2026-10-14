"""Test doubles for the ingest workflow."""

from collections.abc import Sequence

from clearcare_pipeline.ingest_reports.models import InspectionReport


class FakeCatalogue:
    """What the database holds, for a test to state.

    known_files is the set of hashes the store holds; None means every hash
    is found, so nothing is skipped for a missing file. known_centres is the
    set of centre ids the register holds; None means every centre is found.
    """

    def __init__(
        self,
        known_files: set[str] | None = None,
        known_centres: set[str] | None = None,
    ) -> None:
        self._known_files = known_files
        self._known_centres = known_centres

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
