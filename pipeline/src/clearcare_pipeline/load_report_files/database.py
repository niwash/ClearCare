"""Adding a source_file row for each stored inspection report file."""

from collections.abc import Iterable

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
