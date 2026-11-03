# The run lock and the ledger, against a real PostgreSQL (ADR-0022).

from collections.abc import Iterator
from typing import Any

import pytest
from psycopg import errors
from psycopg.rows import dict_row

from clearcare_pipeline.pipeline_run import PipelineRun
from tests.database import (
    PASSWORDS,
    PIPELINE,
    Database,
    migrated_database,
)

pytestmark = pytest.mark.database

Row = dict[str, Any]


@pytest.fixture(scope="module")
def database() -> Iterator[Database]:
    with migrated_database() as database:
        yield database


@pytest.fixture
def configured(database: Database, monkeypatch: pytest.MonkeyPatch) -> None:
    """Points psycopg at the test database as the pipeline's own role."""
    monkeypatch.setenv("PGHOST", database.host)
    monkeypatch.setenv("PGPORT", str(database.port))
    monkeypatch.setenv("PGDATABASE", "clearcare")
    monkeypatch.setenv("PGUSER", PIPELINE)
    monkeypatch.setenv("PGPASSWORD", PASSWORDS[PIPELINE])


def _last(database: Database) -> Row:
    with (
        database.connect(PIPELINE) as connection,
        connection.cursor(row_factory=dict_row) as cursor,
    ):
        rows: list[Row] = cursor.execute(
            "SELECT id, finished_at, outcome, exit_code, detail"
            " FROM clearcare.pipeline_run ORDER BY id"
        ).fetchall()
    return rows[-1]


def test_a_run_is_open_while_it_runs_and_closed_when_it_ends(
    database: Database, configured: None
) -> None:
    run = PipelineRun.try_begin()

    assert run is not None
    opened = _last(database)
    assert (
        opened["finished_at"],
        opened["outcome"],
        opened["exit_code"],
        opened["detail"],
    ) == (None, "running", None, None)

    run.finish("failed", 1, "ingest_reports exited with status 1")
    run.close()

    closed = _last(database)
    assert closed["id"] == opened["id"]
    assert closed["outcome"] == "failed"
    assert closed["exit_code"] == 1
    assert closed["detail"] == "ingest_reports exited with status 1"
    assert closed["finished_at"] is not None


def test_a_second_run_is_refused_while_the_first_holds_the_lock(
    configured: None,
) -> None:
    first = PipelineRun.try_begin()

    assert first is not None
    assert PipelineRun.try_begin() is None

    first.close()

    second = PipelineRun.try_begin()
    assert second is not None
    second.close()


def test_a_run_that_was_killed_leaves_an_open_row(
    database: Database, configured: None
) -> None:
    run = PipelineRun.try_begin()
    assert run is not None
    # finish() is what a killed task never gets to do.
    run.close()

    assert _last(database)["outcome"] == "running"
    assert _last(database)["finished_at"] is None


def test_the_pipeline_cannot_delete_a_run(
    database: Database, configured: None
) -> None:
    with (
        database.connect(PIPELINE) as connection,
        pytest.raises(errors.InsufficientPrivilege),
    ):
        connection.execute("DELETE FROM clearcare.pipeline_run")


def test_a_run_cannot_be_closed_with_an_outcome_nobody_knows(
    database: Database, configured: None
) -> None:
    run = PipelineRun.try_begin()
    assert run is not None

    # finish() logs the database's refusal instead of raising, so the row
    # stays open for the operator to find.
    run.finish("abandoned", 1, None)
    run.close()

    assert _last(database)["outcome"] == "running"
