# A real PostgreSQL for the database tests: infra/postgres/roles.sql runs from
# the image's init scripts and the migrations create the schema. These tests
# need Docker; leave them out with `uv run pytest -m "not database"`.

import secrets
from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

import psycopg
from psycopg.rows import TupleRow
from testcontainers.community.postgres import PostgresContainer

REPOSITORY = Path(__file__).resolve().parents[2]
ROLES_SQL = REPOSITORY / "infra" / "postgres" / "roles.sql"
MIGRATIONS = (
    REPOSITORY / "db" / "V1__register_entries.sql",
    REPOSITORY / "db" / "V2__inspection_reports.sql",
    REPOSITORY / "db" / "V3__inspection_report_views.sql",
    REPOSITORY / "db" / "V4__re_assessment.sql",
    REPOSITORY / "db" / "V5__inspection_report_text.sql",
    REPOSITORY / "db" / "V6__inspection_commitments.sql",
)
POSTGRES_IMAGE = "postgres:18.6"
SUPERUSER = "postgres"
MIGRATOR = "clearcare_migrator"
PIPELINE = "clearcare_pipeline"
API = "clearcare_api"
LOGIN_ROLES = (MIGRATOR, PIPELINE, API)
PASSWORDS = {role: secrets.token_hex(16) for role in (SUPERUSER, *LOGIN_ROLES)}

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


@contextmanager
def migrated_database() -> Generator[Database]:
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
            for migration in MIGRATIONS:
                connection.execute(migration.read_bytes())
        yield database
