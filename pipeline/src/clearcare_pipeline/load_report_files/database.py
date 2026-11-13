"""Adding the stored report files and what the centre pages said."""

from collections.abc import Iterable, Mapping, Sequence

import psycopg
from psycopg.rows import TupleRow

from clearcare_pipeline.reports.centre_page import Report

# source_file.source for every report file.
SOURCE = "inspection_report"

Connection = psycopg.Connection[TupleRow]


def add_report_files(connection: Connection, reports: Iterable[Report]) -> int:
    """Adds a source_file row for each report file, in one transaction.

    A report file whose URL and fetched_at already have a row is left out, so
    running again adds nothing. The reports manifest does not record HTTP
    Last-Modified, so http_last_modified stays NULL.

    Args:
        connection: Logs in as clearcare_pipeline and has no transaction open.
        reports: Reports with a stored copy, so sha256 and fetched_at are set.

    Returns:
        How many rows were added.
    """
    with connection.transaction(), connection.cursor() as cursor:
        cursor.executemany(
            "INSERT INTO clearcare.source_file"
            " (source, url, sha256, fetched_at)"
            " VALUES (%s, %s, %s, %s)"
            " ON CONFLICT (source, url, fetched_at) DO NOTHING",
            [
                (SOURCE, report.url, report.sha256, report.fetched_at)
                for report in reports
            ],
        )
        return cursor.rowcount


def record_page_checks(
    connection: Connection, checks: Mapping[str, str]
) -> int:
    """Stores when each centre's page was last read, in one transaction.

    A centre's row only moves on to a later read, so loading an older
    manifest again changes nothing. A centre the database does not have yet
    is left out; a later run adds it once the register has it.

    Args:
        connection: Logs in as clearcare_pipeline and has no transaction open.
        checks: Each centre's last page read, by centre ID.

    Returns:
        How many rows were added or moved on.
    """
    with connection.transaction(), connection.cursor() as cursor:
        cursor.executemany(
            "INSERT INTO clearcare.centre_page_check (centre_id, checked_at)"
            # A SELECT list does not take its types from the columns.
            " SELECT %(centre_id)s::text, %(checked_at)s::timestamptz"
            " WHERE EXISTS (SELECT FROM clearcare.centre"
            "  WHERE centre_id = %(centre_id)s)"
            " ON CONFLICT (centre_id) DO UPDATE"
            " SET checked_at = excluded.checked_at"
            " WHERE excluded.checked_at > centre_page_check.checked_at",
            [
                {"centre_id": centre_id, "checked_at": checked_at}
                for centre_id, checked_at in checks.items()
            ],
        )
        return cursor.rowcount


def store_listed_reports(
    connection: Connection, listed: Mapping[str, Sequence[Report]]
) -> int:
    """Stores the reports HIQA lists for each centre, in one transaction.

    A report is added, or changed if it is now listed with other values or
    its file has been stored since. A report stored with the same values is
    left alone, so loading the same manifest again changes nothing, and a
    report no longer listed stays. A centre the database does not have yet
    is left out; a later run adds its reports once the register has it.

    Args:
        connection: Logs in as clearcare_pipeline and has no transaction open.
        listed: Each centre's listed reports, by centre ID.

    Returns:
        How many rows were added or changed.
    """
    with connection.transaction(), connection.cursor() as cursor:
        cursor.executemany(
            "INSERT INTO clearcare.listed_report (centre_id, url, file_name,"
            " inspection_date, published_date, report_type, sha256)"
            # A SELECT list does not take its types from the columns.
            " SELECT %(centre_id)s::text, %(url)s::text, %(file_name)s::text,"
            " %(inspection_date)s::date, %(published_date)s::date,"
            " %(report_type)s::text, %(sha256)s::text"
            " WHERE EXISTS (SELECT FROM clearcare.centre"
            "  WHERE centre_id = %(centre_id)s)"
            " ON CONFLICT (centre_id, url) DO UPDATE"
            " SET file_name = excluded.file_name,"
            " inspection_date = excluded.inspection_date,"
            " published_date = excluded.published_date,"
            " report_type = excluded.report_type, sha256 = excluded.sha256"
            # sha256 can be NULL, which = would not compare.
            " WHERE (listed_report.file_name, listed_report.inspection_date,"
            " listed_report.published_date, listed_report.report_type,"
            " listed_report.sha256) IS DISTINCT FROM (excluded.file_name,"
            " excluded.inspection_date, excluded.published_date,"
            " excluded.report_type, excluded.sha256)",
            [
                {
                    "centre_id": centre_id,
                    "url": report.url,
                    "file_name": report.file_name,
                    "inspection_date": report.inspection_date,
                    "published_date": report.published_date,
                    "report_type": report.report_type,
                    "sha256": report.sha256,
                }
                for centre_id, reports in listed.items()
                for report in reports
            ],
        )
        return cursor.rowcount
