# Adds report files through the command line to a real PostgreSQL
# (tests/database.py), as the pipeline's role, and reads them back.

import logging
from collections.abc import Iterator
from dataclasses import replace
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pytest
from psycopg.rows import dict_row

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
        connection.execute(
            "TRUNCATE clearcare.source_file, clearcare.centre CASCADE"
        )
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


def _download_run(
    data_dir: Path,
    *reports: Report,
    centre_id: str = "34",
    fetched_at: str = FETCHED_AT,
    error: str | None = None,
) -> None:
    """Appends a centre's manifest line, as a report download run does."""
    record = CentreRecord(
        centre_id=centre_id,
        url="https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall",
        fetched_at=fetched_at,
        page_sha256="c" * 64,
        reports=reports,
        error=error,
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


def _register(database: Database, *centre_ids: str) -> None:
    """Adds the centres, as loading the register does."""
    with database.connect(SUPERUSER) as connection:
        for centre_id in centre_ids:
            connection.execute(
                "INSERT INTO clearcare.centre (centre_id) VALUES (%s)",
                (centre_id,),
            )


def _checks(database: Database) -> list[tuple[object, ...]]:
    with database.connect(PIPELINE) as connection:
        return connection.execute(
            "SELECT centre_id, checked_at FROM clearcare.centre_page_check"
            " ORDER BY centre_id"
        ).fetchall()


def test_each_centres_last_page_read_is_stored(
    database: Database, tmp_path: Path
) -> None:
    _register(database, "34", "35")
    _download_run(tmp_path, _report("a.pdf", "a" * 64))
    _download_run(tmp_path, centre_id="35")
    # A centre the register does not have yet is left for a later run.
    _download_run(tmp_path, centre_id="36")

    code = _load(tmp_path)

    assert code == 0
    checked = datetime(2026, 10, 2, 9, tzinfo=UTC)
    assert _checks(database) == [("34", checked), ("35", checked)]


def test_a_later_read_moves_the_check_on_and_a_failed_one_does_not(
    database: Database, tmp_path: Path
) -> None:
    _register(database, "34")
    _download_run(tmp_path)
    _load(tmp_path)
    _download_run(tmp_path, fetched_at="2026-10-03T09:00:00+00:00")
    _download_run(
        tmp_path, fetched_at="2026-10-04T09:00:00+00:00", error="HTTP 503"
    )

    code = _load(tmp_path)

    assert code == 0
    assert _checks(database) == [("34", datetime(2026, 10, 3, 9, tzinfo=UTC))]


def _listed(database: Database) -> list[dict[str, Any]]:
    with (
        database.connect(PIPELINE) as connection,
        connection.cursor(row_factory=dict_row) as cursor,
    ):
        return cursor.execute(
            "SELECT centre_id, url, file_name, inspection_date,"
            " published_date, report_type, sha256"
            " FROM clearcare.listed_report ORDER BY centre_id, file_name"
        ).fetchall()


def _file_names(database: Database) -> list[tuple[str, str]]:
    return [(row["centre_id"], row["file_name"]) for row in _listed(database)]


def test_each_report_hiqa_lists_is_stored_with_or_without_a_copy(
    database: Database, tmp_path: Path
) -> None:
    _register(database, "34")
    _download_run(tmp_path, _report("a.pdf", "a" * 64), _report("b.pdf", None))

    code = _load(tmp_path)

    assert code == 0
    assert _listed(database) == [
        {
            "centre_id": "34",
            "url": REPORTS_URL + "a.pdf",
            "file_name": "a.pdf",
            "inspection_date": date(2026, 4, 10),
            "published_date": date(2026, 8, 27),
            "report_type": "Nursing Homes",
            "sha256": "a" * 64,
        },
        {
            "centre_id": "34",
            "url": REPORTS_URL + "b.pdf",
            "file_name": "b.pdf",
            "inspection_date": date(2026, 4, 10),
            "published_date": date(2026, 8, 27),
            "report_type": "Nursing Homes",
            "sha256": None,
        },
    ]


def test_loading_the_same_list_again_changes_nothing(
    database: Database, tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    _register(database, "34")
    listed = (_report("a.pdf", "a" * 64), _report("b.pdf", None))
    _download_run(tmp_path, *listed)
    _load(tmp_path)
    # The next download run finds the same list on the page.
    _download_run(tmp_path, *listed, fetched_at="2026-10-03T09:00:00+00:00")
    _load(tmp_path)

    assert _file_names(database) == [("34", "a.pdf"), ("34", "b.pdf")]
    assert "2 of 2 listed reports added or changed" in caplog.text
    assert "0 of 2 listed reports added or changed" in caplog.text


def test_a_report_listed_with_other_values_is_changed(
    database: Database, tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    _register(database, "34")
    _download_run(tmp_path, _report("a.pdf", "a" * 64), _report("b.pdf", None))
    _load(tmp_path)
    # A later run stores b.pdf, and HIQA has moved a.pdf's published date.
    _download_run(
        tmp_path,
        replace(_report("a.pdf", "a" * 64), published_date="2026-08-28"),
        _report("b.pdf", "b" * 64),
        fetched_at="2026-10-03T09:00:00+00:00",
    )

    _load(tmp_path)

    assert [
        (row["file_name"], row["published_date"], row["sha256"])
        for row in _listed(database)
    ] == [
        ("a.pdf", date(2026, 8, 28), "a" * 64),
        ("b.pdf", date(2026, 8, 27), "b" * 64),
    ]
    assert "2 of 2 listed reports added or changed" in caplog.text


def test_the_inspection_date_is_stored_as_hiqa_lists_it(
    database: Database, tmp_path: Path
) -> None:
    # One report on HIQA's list has the year 0026. It is not corrected here.
    _register(database, "34")
    _download_run(
        tmp_path,
        replace(_report("a.pdf", "a" * 64), inspection_date="0026-01-09"),
    )

    _load(tmp_path)

    assert [row["inspection_date"] for row in _listed(database)] == [
        date(26, 1, 9)
    ]


def test_a_report_hiqa_no_longer_lists_stays(
    database: Database, tmp_path: Path
) -> None:
    _register(database, "34")
    _download_run(
        tmp_path, _report("a.pdf", "a" * 64), _report("b.pdf", "b" * 64)
    )
    _load(tmp_path)
    _download_run(
        tmp_path,
        _report("a.pdf", "a" * 64),
        fetched_at="2026-10-03T09:00:00+00:00",
    )

    _load(tmp_path)

    assert _file_names(database) == [("34", "a.pdf"), ("34", "b.pdf")]


def test_the_list_of_a_centre_the_register_lacks_waits_for_it(
    database: Database, tmp_path: Path
) -> None:
    _register(database, "34")
    _download_run(tmp_path, _report("a.pdf", "a" * 64))
    _download_run(tmp_path, _report("c.pdf", "c" * 64), centre_id="36")

    _load(tmp_path)
    without_36 = _file_names(database)
    _register(database, "36")
    _load(tmp_path)

    assert without_36 == [("34", "a.pdf")]
    assert _file_names(database) == [("34", "a.pdf"), ("36", "c.pdf")]
