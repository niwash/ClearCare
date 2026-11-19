"""The command line entry point: the gate, the settings and the exit codes."""

import pytest

from clearcare_pipeline.exit_codes import EXIT_DONE, EXIT_FAILED, EXIT_RETRY
from clearcare_pipeline.send_alerts.__main__ import main
from tests.database import (
    PASSWORDS,
    PIPELINE,
    Database,
    migrated_database,
)

GOOD_CLOSED = {"CLEARCARE_ALERTS": "off"}


def _libpq(database: Database) -> dict[str, str]:
    return {
        "PGHOST": database.host,
        "PGPORT": str(database.port),
        "PGDATABASE": "clearcare",
        "PGUSER": PIPELINE,
        "PGPASSWORD": PASSWORDS[PIPELINE],
    }


def test_a_misdeclared_gate_fails_before_the_database_is_touched(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for name, value in GOOD_CLOSED.items():
        monkeypatch.setenv(name, value)
    monkeypatch.setenv("CLEARCARE_ALERTS", "maybe")

    assert main([]) == EXIT_FAILED


def test_a_closed_gate_pass_consumes_the_events_and_finishes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        connection.execute(
            "INSERT INTO clearcare.alert_events"
            " (alert_package_id, task_uuid, status, metadata)"
            " SELECT id, gen_random_uuid(), 'pending',"
            ' \'[{"centre_id": "117"}]\'::jsonb'
            " FROM clearcare.alert_packages WHERE scope = 'CENTRE'"
        )
        for name, value in {**_libpq(database), **GOOD_CLOSED}.items():
            monkeypatch.setenv(name, value)

        assert main([]) == EXIT_DONE
        rows = connection.execute(
            "SELECT status FROM clearcare.alert_events"
        ).fetchall()
        assert rows == [("processed",)]


def test_more_events_than_one_pass_claims_leave_the_run_incomplete(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        connection.execute(
            "INSERT INTO clearcare.alert_events"
            " (alert_package_id, task_uuid, status, metadata)"
            " SELECT id, gen_random_uuid(), 'pending',"
            ' \'[{"centre_id": "117"}]\'::jsonb'
            " FROM clearcare.alert_packages, generate_series(1, 501)"
            " WHERE scope = 'CENTRE'"
        )
        for name, value in {**_libpq(database), **GOOD_CLOSED}.items():
            monkeypatch.setenv(name, value)

        assert main([]) == EXIT_RETRY
