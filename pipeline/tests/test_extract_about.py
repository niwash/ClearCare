"""Tests for the About backfill. The database tests need Docker."""

from pathlib import Path

import pytest

from clearcare_pipeline.extract_about import backfill, main
from clearcare_pipeline.raw_store import FileSystemRawStore
from tests.database import API, PIPELINE, migrated_database

FIXTURE = Path(__file__).parent / "fixtures" / "test_parser.pdf"
MISSING_SHA = "ef" * 32

STORE = (
    "INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)"
    " VALUES ('inspection-reports', %s, %s, now()) RETURNING source_file_id"
)
REPORT = (
    "INSERT INTO clearcare.inspection_report (source_file_id, centre_id,"
    " centre_code, centre_name, address, fieldwork_id)"
    " VALUES (%s, %s, 'OSV-1', 'Fern Valley', 'Sample Street', %s)"
)


def test_main_reports_a_missing_database(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("PGHOST", "/nonexistent")
    monkeypatch.setenv("PGCONNECT_TIMEOUT", "1")

    assert main(["--data-dir", str(tmp_path)]) == 1


@pytest.mark.database
def test_about_is_kept_once_and_a_missing_file_fails(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    digest = FileSystemRawStore(tmp_path / "raw").put(FIXTURE.read_bytes())
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        for centre in ("117", "118"):
            connection.execute(
                "INSERT INTO clearcare.centre (centre_id) VALUES (%s)",
                (centre,),
            )
        for centre, sha in (("117", digest), ("118", MISSING_SHA)):
            stored = connection.execute(
                STORE, (f"https://example.test/{centre}.pdf", sha)
            ).fetchone()
            assert stored is not None
            connection.execute(REPORT, (stored[0], centre, f"MON-{centre}"))

        summary = backfill(connection, tmp_path)

        assert (summary.parsed, summary.written, summary.failed) == (1, 1, 1)
        assert "report 2" in caplog.text
        with database.connect(API) as reader:
            row = reader.execute(
                "SELECT regulation, first_page, extractor_version, text"
                " FROM clearcare.report_text WHERE kind = 'about'"
            ).fetchone()
        assert row is not None
        assert row[:3] == (None, 2, "about-v1")
        assert "Hillview Nursing Home" in row[3]
        # A second run writes nothing for the report that has its text.
        again = backfill(connection, tmp_path)
        assert (again.written, again.failed) == (0, 1)
