# A real PostgreSQL for the database tests: infra/postgres/postgis.sh installs
# PostGIS, as compose.yaml has it, infra/postgres/roles.sql creates the roles,
# and the migrations create the schema. These tests need Docker; leave them
# out with `uv run pytest -m "not database"`.

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
POSTGIS_SH = REPOSITORY / "infra" / "postgres" / "postgis.sh"
MIGRATIONS = (
    REPOSITORY / "db" / "V1__register_entries.sql",
    REPOSITORY / "db" / "V2__inspection_reports.sql",
    REPOSITORY / "db" / "V3__inspection_report_views.sql",
    REPOSITORY / "db" / "V4__re_assessment.sql",
    REPOSITORY / "db" / "V5__inspection_report_text.sql",
    REPOSITORY / "db" / "V6__inspection_commitments.sql",
    REPOSITORY / "db" / "V7__centre_phone.sql",
    REPOSITORY / "db" / "V8__contract_prices.sql",
    REPOSITORY / "db" / "V9__centre_contract_price_view.sql",
    REPOSITORY / "db" / "V10__centre_contract_price_home_type.sql",
    REPOSITORY / "db" / "V11__report_amenities.sql",
    REPOSITORY / "db" / "V12__report_amenities_v2.sql",
    REPOSITORY / "db" / "V13__pipeline_run.sql",
    REPOSITORY / "db" / "V14__finding_re_assessment.sql",
    REPOSITORY / "db" / "V15__user_preferences.sql",
    REPOSITORY / "db" / "V16__centre_location.sql",
)
# The same image as compose.yaml, which says why it is this one.
POSTGRES_IMAGE = (
    "postgis/postgis:18-3.6"
    "@sha256:530bb81ad6c5993ae870ea66095d9dc758ef5866007186833f31fb2bebdd5791"
)
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
    )
    # In place of the image's own script, as in compose.yaml.
    container.with_volume_mapping(
        str(POSTGIS_SH), "/docker-entrypoint-initdb.d/10_postgis.sh", "ro"
    )
    container.with_volume_mapping(
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
