# Checks the view of what each judgment became at the centre's next report
# (db/V4) against a real PostgreSQL. Each test stores reports as the pipeline
# does and reads the view as the API does.

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
    centre: str = CENTRE,
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
        " VALUES (%s, %s, %s, 'Fern Valley Nursing Home',"
        " 'Sample Street, Carlow', %s, %s)"
        " RETURNING id",
        (
            stored[0],
            centre,
            f"OSV-{centre:0>7}",
            inspection_date,
            fieldwork_id,
        ),
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


def _next_results(
    connection: Connection, report_id: int
) -> list[tuple[Any, ...]]:
    """The view's rows for one earlier report."""
    connection.execute("SET ROLE clearcare_api")
    return connection.execute(
        "SELECT regulation, judgment, next_result, next_report_id,"
        " days_between"
        " FROM clearcare.next_inspection_result"
        " WHERE report_id = %s ORDER BY regulation",
        (report_id,),
    ).fetchall()


def test_each_report_is_followed_to_the_centres_next_report(
    connection: Connection,
) -> None:
    # Stored newest first, so that only the dates put them in order.
    third = _report(
        connection, "MON-3", date(2025, 2, 7), ("Regulation 15", "Compliant")
    )
    second = _report(
        connection,
        "MON-2",
        date(2024, 3, 4),
        ("Regulation 15", "Substantially compliant"),
    )
    first = _report(
        connection,
        "MON-1",
        date(2023, 6, 29),
        ("Regulation 15", "Not compliant"),
    )
    # Another centre's report, dated between the first two.
    connection.execute(
        "INSERT INTO clearcare.centre (centre_id) VALUES ('118')"
    )
    other_centre = _report(
        connection,
        "MON-4",
        date(2023, 11, 15),
        ("Regulation 15", "Compliant"),
        centre="118",
    )

    assert _next_results(connection, first) == [
        (
            "Regulation 15",
            "Not compliant",
            "Substantially compliant",
            second,
            249,
        )
    ]
    # The middle report is the first one's next report and an earlier report
    # itself; this is every column the view has.
    with connection.cursor(row_factory=dict_row) as cursor:
        middle = cursor.execute(
            "SELECT * FROM clearcare.next_inspection_result"
            " WHERE report_id = %s",
            (second,),
        ).fetchall()
    assert middle == [
        {
            "centre_id": CENTRE,
            "report_id": second,
            "next_report_id": third,
            "inspection_date": date(2024, 3, 4),
            "next_inspection_date": date(2025, 2, 7),
            "days_between": 340,
            "regulation": "Regulation 15",
            "judgment": "Substantially compliant",
            "next_result": "Compliant",
        }
    ]
    assert _next_results(connection, third) == [
        ("Regulation 15", "Compliant", "no later report", None, None)
    ]
    assert _next_results(connection, other_centre) == [
        ("Regulation 15", "Compliant", "no later report", None, None)
    ]


def test_regulation_missing_from_the_next_report_is_not_re_assessed(
    connection: Connection,
) -> None:
    first = _report(
        connection,
        "MON-1",
        date(2024, 1, 10),
        ("Regulation 15", "Not compliant"),
        ("Regulation 16", "Substantially compliant"),
    )
    second = _report(
        connection, "MON-2", date(2024, 7, 1), ("Regulation 15", "Compliant")
    )

    assert _next_results(connection, first) == [
        ("Regulation 15", "Not compliant", "Compliant", second, 173),
        (
            "Regulation 16",
            "Substantially compliant",
            "not re-assessed",
            second,
            173,
        ),
    ]


def test_report_without_a_date_is_left_out(connection: Connection) -> None:
    undated = _report(
        connection, "MON-1", None, ("Regulation 15", "Not compliant")
    )
    dated = _report(
        connection, "MON-2", date(2024, 7, 1), ("Regulation 15", "Compliant")
    )

    assert _next_results(connection, undated) == []
    assert _next_results(connection, dated) == [
        ("Regulation 15", "Compliant", "no later report", None, None)
    ]


def test_report_followed_by_two_reports_on_one_date_is_left_out(
    connection: Connection,
) -> None:
    earlier = _report(
        connection,
        "MON-1",
        date(2024, 1, 10),
        ("Regulation 15", "Not compliant"),
    )
    tied = [
        _report(
            connection,
            fieldwork_id,
            date(2024, 7, 1),
            ("Regulation 15", "Compliant"),
        )
        for fieldwork_id in ("MON-2", "MON-3")
    ]

    assert _next_results(connection, earlier) == []
    # Neither of the two is the other's next report.
    for report_id in tied:
        assert _next_results(connection, report_id) == [
            ("Regulation 15", "Compliant", "no later report", None, None)
        ]


def test_judgment_outside_the_three_is_kept_as_printed(
    connection: Connection,
) -> None:
    first = _report(
        connection,
        "MON-1",
        date(2024, 1, 10),
        ("Regulation 15", "Not compliant"),
    )
    second = _report(
        connection,
        "MON-2",
        date(2024, 7, 1),
        ("Regulation 15", "Partly compliant"),
    )

    assert _next_results(connection, first) == [
        ("Regulation 15", "Not compliant", "Partly compliant", second, 173)
    ]
    assert _next_results(connection, second) == [
        ("Regulation 15", "Partly compliant", "no later report", None, None)
    ]


def test_regulation_listed_twice_keeps_its_first_row(
    connection: Connection,
) -> None:
    # As the parser reads report MON-0042617 of centre 329: Appendix 1, then
    # each finding again from the compliance plan, with a capital C.
    first = _report(
        connection,
        "MON-1",
        date(2024, 1, 10),
        ("Regulation 9", "Not compliant"),
        ("Regulation 9", "Not Compliant"),
    )
    second = _report(
        connection,
        "MON-2",
        date(2024, 7, 1),
        ("Regulation 9", "Substantially compliant"),
        ("Regulation 9", "Substantially Compliant"),
    )

    assert _next_results(connection, first) == [
        (
            "Regulation 9",
            "Not compliant",
            "Substantially compliant",
            second,
            173,
        )
    ]
    assert _next_results(connection, second) == [
        (
            "Regulation 9",
            "Substantially compliant",
            "no later report",
            None,
            None,
        )
    ]
