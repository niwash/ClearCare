# The county lookup table (CCARE-90), against a real PostgreSQL.

from collections.abc import Iterator
from typing import Any

import pytest
from psycopg import errors
from psycopg.rows import dict_row

from clearcare_pipeline.load_register.register_csv import COUNTIES
from tests.database import MIGRATOR, Database, migrated_database

pytestmark = pytest.mark.database

Row = dict[str, Any]


@pytest.fixture(scope="module")
def database() -> Iterator[Database]:
    with migrated_database() as database:
        yield database


def _rows(database: Database) -> list[Row]:
    with database.connect(MIGRATOR) as connection:
        connection.execute("SET ROLE clearcare_owner")
        with connection.cursor(row_factory=dict_row) as cursor:
            rows: list[Row] = cursor.execute(
                "SELECT id, name FROM clearcare.county ORDER BY id"
            ).fetchall()
    return rows


def test_the_table_holds_the_26_counties(database: Database) -> None:
    rows = _rows(database)
    assert [row["id"] for row in rows] == list(range(1, 27))
    assert {row["name"] for row in rows} == set(COUNTIES)


def test_a_county_name_is_unique(database: Database) -> None:
    with (
        database.connect(MIGRATOR) as connection,
        connection.transaction(force_rollback=True),
    ):
        connection.execute("SET ROLE clearcare_owner")
        with pytest.raises(errors.UniqueViolation):
            connection.execute(
                "INSERT INTO clearcare.county (name) VALUES ('Carlow')"
            )


def test_an_empty_name_is_refused(database: Database) -> None:
    with (
        database.connect(MIGRATOR) as connection,
        connection.transaction(force_rollback=True),
    ):
        connection.execute("SET ROLE clearcare_owner")
        with pytest.raises(errors.CheckViolation):
            connection.execute(
                "INSERT INTO clearcare.county (name) VALUES ('')"
            )
