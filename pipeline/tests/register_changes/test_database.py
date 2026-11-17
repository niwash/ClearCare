# Runs the stage through the command line against a real PostgreSQL
# (tests/database.py), as the pipeline's role, and reads the changes back.

import logging
from collections.abc import Iterator
from datetime import date
from pathlib import Path
from typing import Any

import pytest
from psycopg.rows import dict_row

from clearcare_pipeline.load_register.__main__ import main as load_register
from clearcare_pipeline.register_changes import database as changes_database
from clearcare_pipeline.register_changes.__main__ import main
from tests.database import (
    PASSWORDS,
    PIPELINE,
    SUPERUSER,
    Database,
    migrated_database,
)
from tests.load_register.fakes import ELM_HALL, centre, store_snapshot

pytestmark = pytest.mark.database

MONDAY = "2026-10-05T06:12:54+00:00"
TUESDAY = "2026-10-06T06:03:11+00:00"
WEDNESDAY = "2026-10-07T06:08:40+00:00"
THURSDAY = "2026-10-08T06:01:02+00:00"
USUAL_THREE = (
    "Condition 1 The designated centre shall be operated in accordance with"
    " the Statement of Purpose.Condition 2Only persons aged 18 years or older"
    " shall be accommodated at the designated centre at any time.Condition 3"
    "The maximum number of persons that may be accommodated at the designated"
    " centre is: 62."
)
NO_FIELDS = {
    "condition_number": None,
    "before_text": None,
    "after_text": None,
    "beds_before": None,
    "beds_after": None,
    "registered_until": None,
    "registration_number": None,
}


@pytest.fixture(scope="module")
def server() -> Iterator[Database]:
    with migrated_database() as database:
        yield database


@pytest.fixture
def database(server: Database, monkeypatch: pytest.MonkeyPatch) -> Database:
    # Each test starts with no centres and no changes. The stage finds the
    # database through libpq's variables, as it does in a scheduled task.
    with server.connect(SUPERUSER) as connection:
        connection.execute(
            "TRUNCATE clearcare.register_publication,"
            " clearcare.register_entry, clearcare.centre,"
            " clearcare.source_file CASCADE"
        )
    monkeypatch.setenv("PGHOST", server.host)
    monkeypatch.setenv("PGPORT", str(server.port))
    monkeypatch.setenv("PGDATABASE", "clearcare")
    monkeypatch.setenv("PGUSER", PIPELINE)
    monkeypatch.setenv("PGPASSWORD", PASSWORDS[PIPELINE])
    monkeypatch.setenv("CLEARCARE_PIPELINE_VERSION", "test")
    return server


def _run(data_dir: Path) -> int:
    return main(["--data-dir", str(data_dir)])


def _register(database: Database, *centre_ids: str) -> None:
    """Adds the centres, as loading the register does."""
    with database.connect(SUPERUSER) as connection:
        for centre_id in centre_ids:
            connection.execute(
                "INSERT INTO clearcare.centre (centre_id) VALUES (%s)",
                (centre_id,),
            )


def _changes(database: Database) -> list[dict[str, Any]]:
    with (
        database.connect(PIPELINE) as connection,
        connection.cursor(row_factory=dict_row) as cursor,
    ):
        return cursor.execute(
            "SELECT centre_id, kind, change_date, shown_on, snapshot_sha256,"
            " condition_number, before_text, after_text, beds_before,"
            " beds_after, registered_until, registration_number,"
            " rules_version FROM clearcare.register_change ORDER BY id"
        ).fetchall()


def test_changes_of_the_stored_snapshots_are_added(
    database: Database, tmp_path: Path
) -> None:
    monday = store_snapshot(
        tmp_path, MONDAY, centre("34", Registration_Conditions=USUAL_THREE)
    )
    tuesday = store_snapshot(
        tmp_path,
        TUESDAY,
        centre(
            "34",
            Maximum_Occupancy="58",
            Registration_Conditions=(
                f"{USUAL_THREE}Condition 4No new residents may be admitted."
            ),
        ),
    )
    load_register(["--data-dir", str(tmp_path)])

    code = _run(tmp_path)

    assert code == 0
    assert _changes(database) == [
        {
            **NO_FIELDS,
            "centre_id": "34",
            "kind": "registration",
            "change_date": date(2024, 3, 14),
            "shown_on": date(2026, 10, 5),
            "snapshot_sha256": monday,
            "registered_until": date(2027, 3, 13),
            "registration_number": "REG-0012345",
            "rules_version": "rules-v1",
        },
        {
            **NO_FIELDS,
            "centre_id": "34",
            "kind": "beds",
            "change_date": date(2026, 10, 6),
            "shown_on": date(2026, 10, 6),
            "snapshot_sha256": tuesday,
            "beds_before": 62,
            "beds_after": 58,
            "rules_version": "rules-v1",
        },
        {
            **NO_FIELDS,
            "centre_id": "34",
            "kind": "condition_added",
            "change_date": date(2026, 10, 6),
            "shown_on": date(2026, 10, 6),
            "snapshot_sha256": tuesday,
            "condition_number": 4,
            "after_text": "No new residents may be admitted.",
            "rules_version": "rules-v1",
        },
    ]


def test_running_again_adds_only_the_changes_of_a_new_snapshot(
    database: Database, tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    _register(database, "34")
    store_snapshot(tmp_path, MONDAY, ELM_HALL)
    first = _run(tmp_path)
    again = _run(tmp_path)
    store_snapshot(
        tmp_path, TUESDAY, centre("34", Centre_Title="Elm Hall Care Centre")
    )
    next_day = _run(tmp_path)

    assert (first, again, next_day) == (0, 0, 0)
    assert [change["kind"] for change in _changes(database)] == [
        "registration",
        "name",
    ]
    assert "1 register changes found, 1 added" in caplog.text
    assert "1 register changes found, 0 added" in caplog.text
    assert "2 register changes found, 1 added" in caplog.text


def test_the_same_file_fetched_on_a_later_day_holds_another_change(
    database: Database, tmp_path: Path
) -> None:
    # HIQA's file can go back to bytes it had before, so Thursday's snapshot
    # is Tuesday's file and its change of beds is still a new one.
    _register(database, "34")
    fewer_beds = centre("34", Maximum_Occupancy="58")
    store_snapshot(tmp_path, MONDAY, ELM_HALL)
    store_snapshot(tmp_path, TUESDAY, fewer_beds)
    store_snapshot(tmp_path, WEDNESDAY, ELM_HALL)
    store_snapshot(tmp_path, THURSDAY, fewer_beds)

    _run(tmp_path)
    after_first_run = len(_changes(database))
    _run(tmp_path)

    changes = _changes(database)
    assert [
        (change["shown_on"], change["beds_before"], change["beds_after"])
        for change in changes
        if change["kind"] == "beds"
    ] == [
        (date(2026, 10, 6), 62, 58),
        (date(2026, 10, 7), 58, 62),
        (date(2026, 10, 8), 62, 58),
    ]
    # The registration and the three changes of beds, and no more of them.
    assert (after_first_run, len(changes)) == (4, 4)


def test_a_change_waits_for_the_database_to_have_its_centre(
    database: Database, tmp_path: Path
) -> None:
    _register(database, "34")
    store_snapshot(tmp_path, MONDAY, ELM_HALL, centre("35"))

    _run(tmp_path)
    without_35 = [change["centre_id"] for change in _changes(database)]
    _register(database, "35")
    _run(tmp_path)

    assert without_35 == ["34"]
    assert [change["centre_id"] for change in _changes(database)] == [
        "34",
        "35",
    ]


def test_another_rules_version_adds_its_changes_beside_the_earlier_ones(
    database: Database, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _register(database, "34")
    store_snapshot(tmp_path, MONDAY, ELM_HALL)

    _run(tmp_path)
    monkeypatch.setattr(changes_database, "RULES_VERSION", "rules-v2")
    _run(tmp_path)

    assert [
        (change["kind"], change["rules_version"])
        for change in _changes(database)
    ] == [("registration", "rules-v1"), ("registration", "rules-v2")]


def test_a_manifest_without_a_register_download_adds_nothing(
    database: Database, tmp_path: Path
) -> None:
    (tmp_path / "manifests").mkdir()
    (tmp_path / "manifests" / "register-snapshots.jsonl").write_text("")

    assert _run(tmp_path) == 0
    assert _changes(database) == []
