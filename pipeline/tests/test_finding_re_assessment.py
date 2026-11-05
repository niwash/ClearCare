# Checks the view that follows each finding to the first later report that
# judges its regulation again (db/V14) against a real PostgreSQL. Each test
# stores reports as the pipeline does and reads the view as the API does.

from collections.abc import Iterator
from datetime import date
from typing import Any

import pytest
from psycopg.rows import dict_row

from tests.database import SUPERUSER, Connection, Database, migrated_database

pytestmark = pytest.mark.database

CENTRE = "117"


@pytest.fixture(scope="module")
def database() -> Iterator[Database]:
    with migrated_database() as database:
        yield database


@pytest.fixture
def connection(database: Database) -> Iterator[Connection]:
    # Rolled back after each test, so each test sees only its own reports.
    with (
        database.connect(SUPERUSER) as connection,
        connection.transaction(force_rollback=True),
    ):
        connection.execute("SET ROLE clearcare_pipeline")
        connection.execute(
            "INSERT INTO clearcare.centre (centre_id) VALUES (%s)", (CENTRE,)
        )
        yield connection


def _report(
    connection: Connection,
    fieldwork_id: str,
    inspection_date: date | None,
    *regulations: tuple[str, str],
) -> int:
    """Stores a report of the centre and returns its id.

    Each regulation is a (regulation, judgment) pair, in report order.
    """
    connection.execute("SET ROLE clearcare_pipeline")
    stored = connection.execute(
        "INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)"
        " VALUES ('inspection-reports', %s, %s, now())"
        " RETURNING source_file_id",
        (f"https://example.test/{fieldwork_id}.pdf", "ab" * 32),
    ).fetchone()
    assert stored is not None
    report = connection.execute(
        "INSERT INTO clearcare.inspection_report (source_file_id, centre_id,"
        " centre_code, centre_name, address, inspection_date, fieldwork_id)"
        " VALUES (%s, %s, 'OSV-0000117', 'Fern Valley Nursing Home',"
        " 'Sample Street, Carlow', %s, %s)"
        " RETURNING id",
        (stored[0], CENTRE, inspection_date, fieldwork_id),
    ).fetchone()
    assert report is not None
    with connection.cursor() as cursor:
        cursor.executemany(
            "INSERT INTO clearcare.inspection_regulation"
            " (report_id, regulation, title, judgment)"
            " VALUES (%s, %s, 'Title', %s)",
            [
                (report[0], regulation, judgment)
                for regulation, judgment in regulations
            ],
        )
    return report[0]


def _re_assessments(
    connection: Connection, report_id: int
) -> list[tuple[Any, ...]]:
    """The view's rows for the findings of one report."""
    connection.execute("SET ROLE clearcare_api")
    return connection.execute(
        "SELECT regulation, judgment, re_assessment_status,"
        " re_assessment_report_id, re_assessment_judgment, reports_between"
        " FROM clearcare.finding_re_assessment"
        " WHERE report_id = %s ORDER BY regulation",
        (report_id,),
    ).fetchall()


def test_finding_is_re_assessed_by_the_next_report_that_judges_it(
    connection: Connection,
) -> None:
    finding = _report(
        connection,
        "MON-1",
        date(2024, 1, 10),
        ("Regulation 28", "Not Compliant"),
    )
    judged = _report(
        connection, "MON-2", date(2024, 7, 1), ("Regulation 28", "Compliant")
    )

    # Every column the view has.
    connection.execute("SET ROLE clearcare_api")
    with connection.cursor(row_factory=dict_row) as cursor:
        rows = cursor.execute(
            "SELECT * FROM clearcare.finding_re_assessment"
        ).fetchall()
    assert rows == [
        {
            "centre_id": CENTRE,
            "report_id": finding,
            "inspection_date": date(2024, 1, 10),
            "regulation": "Regulation 28",
            "title": "Title",
            "judgment": "Not Compliant",
            "re_assessment_status": "re-assessed",
            "re_assessment_report_id": judged,
            "re_assessment_inspection_date": date(2024, 7, 1),
            "re_assessment_judgment": "Compliant",
            "reports_between": 0,
        }
    ]


def test_report_that_does_not_judge_the_regulation_is_passed_over(
    connection: Connection,
) -> None:
    finding = _report(
        connection,
        "MON-1",
        date(2023, 6, 29),
        ("Regulation 28", "Not compliant"),
    )
    _report(
        connection, "MON-2", date(2024, 3, 4), ("Regulation 15", "Compliant")
    )
    judged = _report(
        connection,
        "MON-3",
        date(2025, 2, 7),
        ("Regulation 28", "Substantially compliant"),
    )

    assert _re_assessments(connection, finding) == [
        (
            "Regulation 28",
            "Not compliant",
            "re-assessed",
            judged,
            "Substantially compliant",
            1,
        )
    ]


def test_regulation_no_later_report_judges_is_not_re_assessed(
    connection: Connection,
) -> None:
    finding = _report(
        connection,
        "MON-1",
        date(2024, 1, 10),
        ("Regulation 28", "Not compliant"),
    )
    _report(
        connection, "MON-2", date(2024, 7, 1), ("Regulation 15", "Compliant")
    )

    assert _re_assessments(connection, finding) == [
        ("Regulation 28", "Not compliant", "not re-assessed", None, None, None)
    ]


def test_finding_of_the_latest_report_has_no_later_report(
    connection: Connection,
) -> None:
    _report(
        connection, "MON-1", date(2024, 1, 10), ("Regulation 28", "Compliant")
    )
    latest = _report(
        connection,
        "MON-2",
        date(2024, 7, 1),
        ("Regulation 28", "Substantially compliant"),
    )

    assert _re_assessments(connection, latest) == [
        (
            "Regulation 28",
            "Substantially compliant",
            "no later report",
            None,
            None,
            None,
        )
    ]


def test_compliant_judgment_is_not_a_finding(connection: Connection) -> None:
    report = _report(
        connection,
        "MON-1",
        date(2024, 1, 10),
        ("Regulation 15", "Compliant"),
        ("Regulation 28", "Not compliant"),
    )

    assert [row[0] for row in _re_assessments(connection, report)] == [
        "Regulation 28"
    ]


def test_regulation_listed_twice_is_one_finding(connection: Connection) -> None:
    # As db/V4 describes: Appendix 1, then each finding again from the
    # compliance plan, with a capital C.
    finding = _report(
        connection,
        "MON-1",
        date(2024, 1, 10),
        ("Regulation 9", "Not compliant"),
        ("Regulation 9", "Not Compliant"),
    )
    judged = _report(
        connection,
        "MON-2",
        date(2024, 7, 1),
        ("Regulation 9", "Substantially compliant"),
        ("Regulation 9", "Substantially Compliant"),
    )

    assert _re_assessments(connection, finding) == [
        (
            "Regulation 9",
            "Not compliant",
            "re-assessed",
            judged,
            "Substantially compliant",
            0,
        )
    ]


def test_two_reports_on_the_date_it_is_judged_again_leave_the_order_unknown(
    connection: Connection,
) -> None:
    finding = _report(
        connection,
        "MON-1",
        date(2024, 1, 10),
        ("Regulation 28", "Not compliant"),
    )
    # Only one of the two judges the regulation, but which came first is not
    # known, so neither is named.
    _report(
        connection, "MON-2", date(2024, 7, 1), ("Regulation 28", "Compliant")
    )
    _report(
        connection, "MON-3", date(2024, 7, 1), ("Regulation 15", "Compliant")
    )
    # Not the first judgment again, so not the re-assessment either.
    _report(
        connection, "MON-4", date(2025, 2, 7), ("Regulation 28", "Compliant")
    )

    assert _re_assessments(connection, finding) == [
        ("Regulation 28", "Not compliant", "order unknown", None, None, None)
    ]


def test_two_reports_on_a_date_that_does_not_judge_it_are_both_counted(
    connection: Connection,
) -> None:
    finding = _report(
        connection,
        "MON-1",
        date(2024, 1, 10),
        ("Regulation 28", "Not compliant"),
    )
    for fieldwork_id in ("MON-2", "MON-3"):
        _report(
            connection,
            fieldwork_id,
            date(2024, 7, 1),
            ("Regulation 15", "Compliant"),
        )
    judged = _report(
        connection, "MON-4", date(2025, 2, 7), ("Regulation 28", "Compliant")
    )

    assert _re_assessments(connection, finding) == [
        (
            "Regulation 28",
            "Not compliant",
            "re-assessed",
            judged,
            "Compliant",
            2,
        )
    ]


def test_finding_of_a_report_without_a_date_has_order_unknown(
    connection: Connection,
) -> None:
    undated = _report(
        connection, "MON-1", None, ("Regulation 28", "Not compliant")
    )
    dated = _report(
        connection,
        "MON-2",
        date(2024, 7, 1),
        ("Regulation 28", "Substantially compliant"),
    )

    assert _re_assessments(connection, undated) == [
        ("Regulation 28", "Not compliant", "order unknown", None, None, None)
    ]
    # Nor is the undated report a later report of the dated one.
    assert _re_assessments(connection, dated) == [
        (
            "Regulation 28",
            "Substantially compliant",
            "no later report",
            None,
            None,
            None,
        )
    ]
