# Adds report files through the command line to a real PostgreSQL
# (tests/database.py), as the pipeline's role, and reads them back.

import logging
from collections.abc import Iterator
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path

import pytest

from clearcare_pipeline.load_report_files.__main__ import main
from clearcare_pipeline.reports.centre_page import Report
from clearcare_pipeline.reports.manifest import (
    MANIFEST_NAME,
    CentreRecord,
    append_record,
)
from tests.database import (
    PASSWORDS,
    PIPELINE,
    SUPERUSER,
    Database,
    migrated_database,
)

pytestmark = pytest.mark.database

REPORTS_URL = "https://www.hiqa.ie/system/files/inspectionreports/"
FETCHED_AT = "2026-10-02T09:00:00+00:00"


@pytest.fixture(scope="module")
def server() -> Iterator[Database]:
    with migrated_database() as database:
        yield database


@pytest.fixture
def database(server: Database, monkeypatch: pytest.MonkeyPatch) -> Database:
    # Each test starts with no source files. The command finds the database
    # through libpq's variables, as it does on the VM.
    with server.connect(SUPERUSER) as connection:
        connection.execute("TRUNCATE clearcare.source_file CASCADE")
    monkeypatch.setenv("PGHOST", server.host)
    monkeypatch.setenv("PGPORT", str(server.port))
    monkeypatch.setenv("PGDATABASE", "clearcare")
    monkeypatch.setenv("PGUSER", PIPELINE)
    monkeypatch.setenv("PGPASSWORD", PASSWORDS[PIPELINE])
    return server


def _report(file_name: str, sha256: str | None) -> Report:
    listed = Report(
        inspection_date="2026-04-10",
        report_type="Nursing Homes",
        published_date="2026-08-27",
        file_name=file_name,
        url=REPORTS_URL + file_name,
    )
    if sha256 is None:
        return replace(listed, error="HTTP 503")
    return replace(listed, sha256=sha256, size=100, fetched_at=FETCHED_AT)


def _download_run(data_dir: Path, *reports: Report) -> None:
    """Appends a centre's manifest line, as a report download run does."""
    record = CentreRecord(
        centre_id="34",
        url="https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall",
        fetched_at=FETCHED_AT,
        page_sha256="c" * 64,
        reports=reports,
        error=None,
    )
    append_record(data_dir / "manifests" / MANIFEST_NAME, record)


def _load(data_dir: Path) -> int:
    return main(["--data-dir", str(data_dir)])


def test_each_stored_report_file_is_added_and_a_failed_download_is_not(
    database: Database, tmp_path: Path
) -> None:
    _download_run(tmp_path, _report("a.pdf", "a" * 64), _report("b.pdf", None))

    code = _load(tmp_path)

    with database.connect(PIPELINE) as connection:
        rows = connection.execute(
            "SELECT source, url, sha256, fetched_at, http_last_modified"
            " FROM clearcare.source_file"
        ).fetchall()
    assert code == 0
    assert rows == [
        (
            "inspection_report",
            REPORTS_URL + "a.pdf",
            "a" * 64,
            datetime(2026, 10, 2, 9, tzinfo=UTC),
            None,
        )
    ]


def test_running_again_adds_nothing(
    database: Database, tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    stored = _report("a.pdf", "a" * 64)
    _download_run(tmp_path, stored)
    first = _load(tmp_path)
    # The next download run lists the report again with the same stored copy.
    _download_run(tmp_path, stored)
    second = _load(tmp_path)

    with database.connect(PIPELINE) as connection:
        count = connection.execute(
            "SELECT count(*) FROM clearcare.source_file"
        ).fetchone()
    assert (first, second) == (0, 0)
    assert count == (1,)
    assert "0 report files added, 1 already there" in caplog.text
