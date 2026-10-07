# Loads register files through the command line into a real PostgreSQL
# (tests/database.py), as the pipeline's role, and reads them back.

from collections.abc import Iterator, Mapping
from pathlib import Path

import pytest
from psycopg.rows import dict_row

from clearcare_pipeline.load_register.__main__ import main
from clearcare_pipeline.raw_store import FileSystemRawStore
from clearcare_pipeline.snapshots.manifest import MANIFEST_NAME, append_records
from clearcare_pipeline.snapshots.snapshot import SnapshotRecord
from clearcare_pipeline.snapshots.sources import OLDER_PERSONS_REGISTER
from tests.database import (
    API,
    PASSWORDS,
    PIPELINE,
    SUPERUSER,
    Database,
    migrated_database,
)
from tests.load_register.fakes import ELM_HALL, centre, register_csv

pytestmark = pytest.mark.database

MONDAY = "2026-10-05T06:12:54+00:00"
TUESDAY = "2026-10-06T06:03:11+00:00"


@pytest.fixture(scope="module")
def server() -> Iterator[Database]:
    with migrated_database() as database:
        yield database


@pytest.fixture
def database(server: Database, monkeypatch: pytest.MonkeyPatch) -> Database:
    # Each test starts from an empty register. The loader finds the database
    # through libpq's variables, as it does on the VM.
    with server.connect(SUPERUSER) as connection:
        connection.execute(
            "TRUNCATE clearcare.register_publication,"
            " clearcare.register_entry, clearcare.centre,"
            " clearcare.source_file"
        )
    monkeypatch.setenv("PGHOST", server.host)
    monkeypatch.setenv("PGPORT", str(server.port))
    monkeypatch.setenv("PGDATABASE", "clearcare")
    monkeypatch.setenv("PGUSER", PIPELINE)
    monkeypatch.setenv("PGPASSWORD", PASSWORDS[PIPELINE])
    monkeypatch.setenv("CLEARCARE_PIPELINE_VERSION", "test")
    return server


def _snapshot(
    data_dir: Path, fetched_at: str, *records: Mapping[str, str]
) -> None:
    """Stores a register file and its manifest line, as a snapshot run does."""
    content = register_csv(*records)
    record = SnapshotRecord(
        source=OLDER_PERSONS_REGISTER.name,
        url=OLDER_PERSONS_REGISTER.url,
        fetched_at=fetched_at,
        attempts=1,
        http_status=200,
        content_type="text/csv",
        size=len(content),
        sha256=FileSystemRawStore(data_dir / "raw").put(content),
        last_modified="Mon, 05 Oct 2026 06:00:00 GMT",
        etag=None,
        error=None,
    )
    append_records(data_dir / "manifests" / MANIFEST_NAME, [record])


def _load(data_dir: Path, *options: str) -> int:
    return main(["--data-dir", str(data_dir), *options])


def _published_names(database: Database) -> list[str]:
    with database.connect(API) as connection:
        rows = connection.execute(
            "SELECT centre_name FROM clearcare.centre_search"
            " ORDER BY centre_id::integer"
        ).fetchall()
    return [name for (name,) in rows]


def test_loaded_register_is_what_search_reads(
    database: Database, tmp_path: Path
) -> None:
    _snapshot(
        tmp_path,
        MONDAY,
        ELM_HALL,
        centre("35", Centre_Title="Ard Na Ri", Maximum_Occupancy=""),
    )

    code = _load(tmp_path)

    with (
        database.connect(API) as connection,
        connection.cursor(row_factory=dict_row) as cursor,
    ):
        rows = cursor.execute(
            "SELECT centre_id, centre_name, county, eircode,"
            " maximum_occupancy FROM clearcare.centre_search"
            " ORDER BY centre_id"
        ).fetchall()
    assert code == 0
    assert rows == [
        {
            "centre_id": "34",
            "centre_name": "Elm Hall Nursing Home",
            "county": "Kildare",
            "eircode": "W23P6EX",
            "maximum_occupancy": 62,
        },
        {
            "centre_id": "35",
            "centre_name": "Ard Na Ri",
            "county": "Kildare",
            "eircode": "W23P6EX",
            "maximum_occupancy": None,
        },
    ]


def test_loading_the_same_snapshot_again_adds_nothing(
    database: Database, tmp_path: Path
) -> None:
    _snapshot(tmp_path, MONDAY, ELM_HALL)

    codes = (_load(tmp_path), _load(tmp_path))
    # The same download recorded with another file is refused.
    _snapshot(tmp_path, MONDAY, centre("34", Centre_Title="Elm Hall Care"))
    conflicting = _load(tmp_path)

    with database.connect(PIPELINE) as connection:
        counts = connection.execute(
            "SELECT (SELECT count(*) FROM clearcare.source_file),"
            " (SELECT count(*) FROM clearcare.register_entry)"
        ).fetchone()
    assert codes == (0, 0)
    assert conflicting == 1
    assert counts == (1, 1)
    assert _published_names(database) == ["Elm Hall Nursing Home"]


def test_snapshot_older_than_the_published_one_is_refused(
    database: Database, tmp_path: Path
) -> None:
    _snapshot(tmp_path, TUESDAY, ELM_HALL)
    _load(tmp_path)
    _snapshot(tmp_path, MONDAY, centre("34", Centre_Title="Elm Hall Care"))

    code = _load(tmp_path)

    assert code == 1
    assert _published_names(database) == ["Elm Hall Nursing Home"]


def test_register_that_lost_over_five_centres_needs_allow_shrink(
    database: Database, tmp_path: Path
) -> None:
    _snapshot(tmp_path, MONDAY, *(centre(str(n)) for n in range(1, 8)))
    _load(tmp_path)
    _snapshot(tmp_path, TUESDAY, centre("1", Centre_Title="Elm Hall Care"))

    refused = _load(tmp_path)
    names_after_refusal = _published_names(database)
    allowed = _load(tmp_path, "--allow-shrink")

    assert (refused, allowed) == (1, 0)
    assert len(names_after_refusal) == 7
    assert _published_names(database) == ["Elm Hall Care"]
