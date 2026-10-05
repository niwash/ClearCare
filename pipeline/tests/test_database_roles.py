# Checks the schema and the grants in db/ against a real PostgreSQL:
# infra/postgres/roles.sql runs from the image's init scripts, V1 creates the
# schema, and each test checks what a role can or cannot do. These tests need
# Docker; leave them out with `uv run pytest -m "not database"`.

import secrets
from collections.abc import Generator, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, LiteralString

import psycopg
import pytest
from psycopg import errors
from psycopg.rows import TupleRow, dict_row
from testcontainers.community.postgres import PostgresContainer

pytestmark = pytest.mark.database

REPOSITORY = Path(__file__).resolve().parents[2]
ROLES_SQL = REPOSITORY / "infra" / "postgres" / "roles.sql"
V1_MIGRATION = REPOSITORY / "db" / "V1__register_entries.sql"
POSTGRES_IMAGE = "postgres:18.6"
SUPERUSER = "postgres"
MIGRATOR = "clearcare_migrator"
PIPELINE = "clearcare_pipeline"
API = "clearcare_api"
LOGIN_ROLES = (MIGRATOR, PIPELINE, API)
PASSWORDS = {role: secrets.token_hex(16) for role in (SUPERUSER, *LOGIN_ROLES)}
ELM_HALL_ADDRESS = (
    "Elm Hall Nursing Home, Loughlinstown Road, Celbridge, W23 P6EX"
)
ELM_HALL_URL = (
    "https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall-nursing-home"
)
REGISTER_URL = (
    "https://www.hiqa.ie/centre/export/older_persons_register.csv?_format=csv"
)
PUBLISHED_SHA256 = "c" * 64
PUBLISHED_AT = datetime(2026, 10, 5, 6, 12, 54, tzinfo=UTC)
PUBLIC_COLUMNS = {
    "centre_id",
    "centre_name",
    "address",
    "county",
    "eircode",
    "maximum_occupancy",
    "hiqa_url",
    "name_key",
    "address_key",
}

Connection = psycopg.Connection[TupleRow]


@dataclass(frozen=True)
class Database:
    host: str
    port: int

    def connect(self, role: str) -> Connection:
        return psycopg.connect(
            host=self.host,
            port=self.port,
            dbname="clearcare",
            user=role,
            password=PASSWORDS[role],
        )


@pytest.fixture(scope="module")
def database() -> Iterator[Database]:
    container = PostgresContainer(
        POSTGRES_IMAGE,
        username=SUPERUSER,
        password=PASSWORDS[SUPERUSER],
        dbname="clearcare",
        driver=None,
    ).with_volume_mapping(
        str(ROLES_SQL), "/docker-entrypoint-initdb.d/roles.sql", "ro"
    )
    for role in LOGIN_ROLES:
        container.with_env(f"{role.upper()}_PASSWORD", PASSWORDS[role])
    with container:
        database = Database(
            host=container.get_container_host_ip(),
            port=int(container.get_exposed_port(5432)),
        )
        # Only the schema and its grants are tested here. Flyway runs the
        # real migrations (ADR-0010).
        with database.connect(MIGRATOR) as connection:
            connection.execute("SET ROLE clearcare_owner")
            connection.execute(V1_MIGRATION.read_bytes())
        with database.connect(PIPELINE) as connection:
            first = _load_snapshot(connection, PUBLISHED_SHA256, PUBLISHED_AT)
            _publish(connection, first)
        yield database


def _load_snapshot(
    connection: Connection,
    sha256: str,
    fetched_at: datetime,
    centre_name: str = "Elm Hall Nursing Home",
) -> int:
    source_file = connection.execute(
        "INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)"
        " VALUES ('older_persons_register', %s, %s, %s)"
        " RETURNING source_file_id",
        (REGISTER_URL, sha256, fetched_at),
    ).fetchone()
    assert source_file is not None
    source_file_id: int = source_file[0]
    connection.execute(
        "INSERT INTO clearcare.centre (centre_id) VALUES ('34')"
        " ON CONFLICT DO NOTHING"
    )
    connection.execute(
        "INSERT INTO clearcare.register_entry (source_file_id, centre_id,"
        " source_record, centre_name, address, county, eircode,"
        " maximum_occupancy, provider_name, provider_cro_number, hiqa_url,"
        " extracted_at, extractor_version)"
        " VALUES (%s, '34', 1, %s, %s, 'Kildare', 'W23P6EX', 62,"
        " 'Springwood Nursing Homes Limited', '409166', %s, now(), 'test')",
        (source_file_id, centre_name, ELM_HALL_ADDRESS, ELM_HALL_URL),
    )
    return source_file_id


def _publish(connection: Connection, source_file_id: int) -> None:
    connection.execute(
        "INSERT INTO clearcare.register_publication"
        " (source_file_id, published_at) VALUES (%s, now())"
        " ON CONFLICT (singleton) DO UPDATE"
        " SET source_file_id = excluded.source_file_id,"
        " published_at = excluded.published_at",
        (source_file_id,),
    )


@contextmanager
def _rolled_back(database: Database, role: str) -> Generator[Connection]:
    with (
        database.connect(role) as connection,
        connection.transaction(force_rollback=True),
    ):
        yield connection


def _published_centres(connection: Connection) -> list[dict[str, Any]]:
    with connection.cursor(row_factory=dict_row) as cursor:
        return cursor.execute(
            "SELECT * FROM clearcare.centre_search"
        ).fetchall()


def test_publishing_a_snapshot_changes_what_search_sees(
    database: Database,
) -> None:
    # One transaction that switches between the two roles, so the API sees the
    # pipeline's uncommitted rows and nothing is left behind for other tests.
    renamed_at = datetime(2026, 10, 6, 6, 0, tzinfo=UTC)
    with _rolled_back(database, SUPERUSER) as connection:
        connection.execute("SET ROLE clearcare_pipeline")
        renamed = _load_snapshot(
            connection, "d" * 64, renamed_at, centre_name="Elm Hall Care Centre"
        )
        connection.execute("SET ROLE clearcare_api")
        before = _published_centres(connection)
        connection.execute("SET ROLE clearcare_pipeline")
        _publish(connection, renamed)
        stored = connection.execute(
            "SELECT centre_name FROM clearcare.register_entry"
            " ORDER BY source_file_id"
        ).fetchall()
        connection.execute("SET ROLE clearcare_api")
        after = _published_centres(connection)
        source = connection.execute(
            "SELECT sha256, fetched_at"
            " FROM clearcare.published_register_snapshot"
        ).fetchall()

    assert [row["centre_name"] for row in before] == ["Elm Hall Nursing Home"]
    assert [row["centre_name"] for row in after] == ["Elm Hall Care Centre"]
    assert source == [("d" * 64, renamed_at)]
    assert stored == [("Elm Hall Nursing Home",), ("Elm Hall Care Centre",)]


def test_api_reads_only_public_columns_of_published_centres(
    database: Database,
) -> None:
    with _rolled_back(database, API) as connection:
        rows = _published_centres(connection)

    assert len(rows) == 1
    centre = rows[0]
    assert centre.keys() == PUBLIC_COLUMNS
    assert "provider_name" not in centre
    assert "provider_cro_number" not in centre
    assert centre["centre_id"] == "34"
    assert centre["eircode"] == "W23P6EX"
    assert centre["name_key"] == "elm hall nursing home"
    assert centre["address_key"] == (
        "elm hall nursing home loughlinstown road celbridge w23 p6ex"
    )


def test_api_reads_where_the_published_snapshot_came_from(
    database: Database,
) -> None:
    with _rolled_back(database, API) as connection:
        rows = connection.execute(
            "SELECT fetched_at, sha256, url"
            " FROM clearcare.published_register_snapshot"
        ).fetchall()

    assert rows == [(PUBLISHED_AT, PUBLISHED_SHA256, REGISTER_URL)]


@pytest.mark.parametrize(
    ("role", "statement"),
    [
        # The migrator owns nothing until it runs SET ROLE clearcare_owner.
        (MIGRATOR, "CREATE TABLE clearcare.notes (note text)"),
        # The pipeline cannot change the schema, nor change or delete facts.
        (PIPELINE, "CREATE TABLE clearcare.notes (note text)"),
        (PIPELINE, "CREATE TABLE public.notes (note text)"),
        (PIPELINE, "CREATE SCHEMA notes"),
        (PIPELINE, "UPDATE clearcare.register_entry SET centre_name = 'x'"),
        (PIPELINE, "DELETE FROM clearcare.register_entry"),
        (PIPELINE, "DELETE FROM clearcare.source_file"),
        (PIPELINE, "DELETE FROM clearcare.register_publication"),
        # The API reads the views, never the tables behind them.
        (API, "SELECT * FROM clearcare.source_file"),
        (API, "SELECT * FROM clearcare.centre"),
        (API, "SELECT * FROM clearcare.register_entry"),
        (API, "SELECT * FROM clearcare.register_publication"),
    ],
)
def test_role_is_refused(
    database: Database, role: str, statement: LiteralString
) -> None:
    with (
        _rolled_back(database, role) as connection,
        pytest.raises(errors.InsufficientPrivilege),
    ):
        connection.execute(statement)


@pytest.mark.parametrize(
    ("value", "key"),
    [
        ("Áras Ui Dhomhnaill", "aras ui dhomhnaill"),
        ("St Joseph's", "st josephs"),
        ("St Joseph\u2019s", "st josephs"),  # right single quotation mark
        ("St Joseph\u2018s", "st josephs"),  # left single quotation mark
        ("St Joseph`s", "st josephs"),
        ("100%_care", "100 care"),
        ("  Ard-na-Rí  ", "ard na ri"),
    ],
)
def test_search_key_folds_text_for_matching(
    database: Database, value: str, key: str
) -> None:
    with _rolled_back(database, API) as connection:
        row = connection.execute(
            "SELECT clearcare.search_key(%s)", (value,)
        ).fetchone()

    assert row == (key,)
