"""Database tests for the alert events the ingest raises (CCARE-248).

A batch that writes two reports for one centre is one facility event, one county
event and one all event, in the same transaction as the reports.
"""

from datetime import date, timedelta
from typing import Any

import pytest

from clearcare_pipeline.ingest_reports.alerts import cutoff
from clearcare_pipeline.ingest_reports.database import ReportWriter
from clearcare_pipeline.ingest_reports.models import InspectionReport
from tests.database import PIPELINE, Database, migrated_database

pytestmark = pytest.mark.database

# The county the centre is in has to be known to the pipeline, and the catalogue
# is created empty by db/V26, so both are seeded here.
SNAPSHOT = """
-- A stored file is loaded once (db/V2), so two reports need two files.
INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)
VALUES
    ('older_persons_register', 'https://www.hiqa.ie/test/register.csv',
     repeat('a', 64), now()),
    ('inspection-reports', 'https://www.hiqa.ie/test/one.pdf',
     repeat('b', 64), now()),
    ('inspection-reports', 'https://www.hiqa.ie/test/two.pdf',
     repeat('c', 64), now());

INSERT INTO clearcare.centre (centre_id) VALUES ('117');

INSERT INTO clearcare.register_entry (
    source_file_id, centre_id, source_record, centre_name, address, county,
    eircode, maximum_occupancy, provider_name, hiqa_url, extracted_at,
    extractor_version)
VALUES (1, '117', 1, 'Fern Valley Nursing Home', 'Sample Street, Carlow',
        'Carlow', NULL, 48, NULL, 'https://www.hiqa.ie/test/117', now(),
        'test');

INSERT INTO clearcare.register_publication (source_file_id, published_at)
VALUES (1, now());

INSERT INTO clearcare.alert_packages (name, scope, is_active) VALUES
    ('A home I follow', 'FACILITY', TRUE),
    ('A county', 'COUNTY', TRUE),
    ('Every home', 'ALL', TRUE);
"""


def _report(source_file_id: int, *, reported: date) -> InspectionReport:
    return InspectionReport(
        source_file_id=source_file_id,
        centre_id="117",
        centre_code="OSV-0000117",
        centre_name="Fern Valley Nursing Home",
        provider_name="Fern Valley Care Limited",
        address="Sample Street, Carlow",
        inspection_type="Unannounced",
        inspection_date=reported,
        fieldwork_id=f"MON-{reported:%Y%m%d}",
        residents=48,
        inspectors=(),
        regulations=(),
        compliance_items=(),
        text=(),
    )


def _reports(database: Database) -> tuple[int, int]:
    """The two stored report files, so a batch can hold two reports."""
    with database.connect(PIPELINE) as connection:
        rows = connection.execute(
            "SELECT source_file_id FROM clearcare.source_file"
            " WHERE source = 'inspection-reports' ORDER BY source_file_id"
        ).fetchall()
    assert len(rows) == 2, rows
    return int(rows[0][0]), int(rows[1][0])


def _events(database: Database) -> list[tuple[str, dict[str, Any]]]:
    with database.connect(PIPELINE) as connection:
        rows = connection.execute(
            "SELECT p.scope, e.metadata FROM clearcare.alert_events e"
            " JOIN clearcare.alert_packages p ON p.id = e.alert_package_id"
            " ORDER BY p.scope"
        ).fetchall()
    return [(str(scope), dict(metadata)) for scope, metadata in rows]


def _prepare(
    database: Database,
    reports: list[InspectionReport],
    *,
    alerts: bool = True,
    run_id: int | None = None,
) -> int:
    with database.connect(PIPELINE) as connection:
        writer = ReportWriter(connection, "test", alerts=alerts, run_id=run_id)
        return writer.write_batch(reports)


def test_a_batch_of_two_reports_raises_one_event_per_scope():
    with migrated_database() as database:
        with database.connect("postgres") as connection:
            connection.execute(SNAPSHOT)

        recent = date.today() - timedelta(days=30)
        first, second = _reports(database)

        # Two inspections of the same home: different fieldwork, one facility
        # event carrying both report ids.
        written = _prepare(
            database,
            [
                _report(first, reported=recent),
                _report(second, reported=recent - timedelta(days=5)),
            ],
            run_id=7,
        )
        assert written == 2

        events = _events(database)
        assert [scope for scope, _ in events] == ["ALL", "COUNTY", "FACILITY"]

        all_metadata = dict(events)["ALL"]
        assert len(all_metadata["report_ids"]) == 2
        assert all_metadata["run_id"] == 7

        county_metadata = dict(events)["COUNTY"]
        assert county_metadata["county_id"] == 1
        assert len(county_metadata["report_ids"]) == 2

        facility_metadata = dict(events)["FACILITY"]
        assert facility_metadata["centre_id"] == "117"
        # The county is stated too, so a county subscription matches this event.
        assert facility_metadata["county_id"] == 1
        assert len(facility_metadata["report_ids"]) == 2


def test_skip_alerts_raises_nothing():
    with migrated_database() as database:
        with database.connect("postgres") as connection:
            connection.execute(SNAPSHOT)

        recent = date.today() - timedelta(days=30)
        source_file_id, _ = _reports(database)

        written = _prepare(
            database, [_report(source_file_id, reported=recent)], alerts=False
        )

        assert written == 1
        assert _events(database) == []


def test_a_repeat_of_the_same_batch_raises_nothing_new():
    with migrated_database() as database:
        with database.connect("postgres") as connection:
            connection.execute(SNAPSHOT)

        recent = date.today() - timedelta(days=30)
        source_file_id, _ = _reports(database)

        first = _prepare(
            database, [_report(source_file_id, reported=recent)]
        )
        assert first == 1
        first = _events(database)

        repeat = _prepare(
            database, [_report(source_file_id, reported=recent)]
        )
        assert repeat == 0
        assert _events(database) == first


def test_a_report_from_the_backlog_raises_nothing():
    with migrated_database() as database:
        with database.connect("postgres") as connection:
            connection.execute(SNAPSHOT)

        old = cutoff(date.today()) - timedelta(days=1)
        source_file_id, _ = _reports(database)

        assert _prepare(database, [_report(source_file_id, reported=old)]) == 1
        assert _events(database) == []
