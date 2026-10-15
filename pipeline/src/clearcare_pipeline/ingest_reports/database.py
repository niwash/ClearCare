"""Writing transformed inspection reports to PostgreSQL."""

from collections.abc import Sequence
from typing import Protocol

import psycopg
from psycopg.rows import TupleRow

from clearcare_pipeline.ingest_reports.models import InspectionReport

# Held until the transaction ends, so two ingests never write at once. Nothing
# else takes this lock in this database, so any fixed number works.
LOCK_KEY = 34

Connection = psycopg.Connection[TupleRow]

# The report's identity is generated, so the row is inserted one at a time to
# read its id back; the records are inserted in bulk once every id is known.
_INSERT_REPORT = (
    "INSERT INTO clearcare.inspection_report"
    " (source_file_id, centre_id, centre_code, centre_name, provider_name,"
    " address, inspection_type, inspection_date, fieldwork_id, residents)"
    " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
    " ON CONFLICT DO NOTHING RETURNING id"
)
_INSERT_INSPECTOR = (
    "INSERT INTO clearcare.inspection_inspector"
    " (report_id, date, start_time, end_time, name, role)"
    " VALUES (%s, %s, %s, %s, %s, %s)"
)
_INSERT_REGULATION = (
    "INSERT INTO clearcare.inspection_regulation"
    " (report_id, regulation, title, judgment) VALUES (%s, %s, %s, %s)"
)
_INSERT_ITEM = (
    "INSERT INTO clearcare.inspection_compliance_item"
    " (report_id, regulation, requirement, judgment, risk_rating,"
    " date_to_comply) VALUES (%s, %s, %s, %s, %s, %s)"
)

Row = tuple[object, ...]


class Catalogue(Protocol):
    """What the database already holds, for the ingest to look reports up in.

    The ingest asks this before it writes anything, so an implementation can
    read it all once rather than answering a query for each report.
    """

    def source_file_id(self, sha256: str) -> int | None:
        """Returns the stored file with this hash, or None if there is none."""
        ...

    def centre_exists(self, centre_id: str) -> bool:
        """Whether the register has loaded this centre."""
        ...

    def report_loaded(self, sha256: str) -> bool:
        """Whether a report has been loaded from a file with this hash."""
        ...


class Writer(Protocol):
    """Where the ingest workflow sends its batches."""

    def write_batch(self, reports: Sequence[InspectionReport]) -> int:
        """Writes a batch and returns how many reports were new."""
        ...


class DatabaseCatalogue:
    """What the database holds, read once when the catalogue is made.

    A run has a few thousand stored files and a few hundred centres to look
    up, so it holds them rather than asking the database again for each one.
    """

    def __init__(self, connection: Connection) -> None:
        """Reads the stored files, the loaded centres and loaded reports.

        A file's bytes can be downloaded more than once, and each download is
        its own row, so the newest row is the one the ingest is about.
        """
        self._source_files: dict[str, int] = {
            str(row[0]): int(row[1])
            for row in connection.execute(
                "SELECT DISTINCT ON (sha256) sha256, source_file_id"
                " FROM clearcare.source_file"
                " ORDER BY sha256, fetched_at DESC"
            ).fetchall()
        }
        self._centres: set[str] = {
            str(row[0])
            for row in connection.execute(
                "SELECT centre_id FROM clearcare.centre"
            ).fetchall()
        }
        # By hash, so a file downloaded again is not parsed again.
        self._loaded: set[str] = {
            str(row[0])
            for row in connection.execute(
                "SELECT DISTINCT sha256 FROM clearcare.source_file"
                " JOIN clearcare.inspection_report USING (source_file_id)"
            ).fetchall()
        }

    def source_file_id(self, sha256: str) -> int | None:
        """Returns the stored file with this hash, or None if there is none."""
        return self._source_files.get(sha256)

    def centre_exists(self, centre_id: str) -> bool:
        """Whether the register has loaded this centre."""
        return centre_id in self._centres

    def report_loaded(self, sha256: str) -> bool:
        """Whether a report has been loaded from a file with this hash."""
        return sha256 in self._loaded


class ReportWriter:
    """Writes reports as clearcare_pipeline, one transaction per batch.

    A report whose file or fieldwork is already stored is left out, so a run
    that is repeated adds nothing.
    """

    def __init__(self, connection: Connection) -> None:
        """Creates a writer over an open connection."""
        self._connection = connection

    def write_batch(self, reports: Sequence[InspectionReport]) -> int:
        """Writes the batch in one transaction; returns how many were new."""
        inspectors: list[Row] = []
        regulations: list[Row] = []
        items: list[Row] = []
        written = 0
        with (
            self._connection.transaction(),
            self._connection.cursor() as cursor,
        ):
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", (LOCK_KEY,))
            for report in reports:
                row = cursor.execute(
                    _INSERT_REPORT, _report_params(report)
                ).fetchone()
                if row is None:
                    continue
                report_id = row[0]
                written += 1
                inspectors.extend(
                    (
                        report_id,
                        inspector.date,
                        inspector.start_time,
                        inspector.end_time,
                        inspector.name,
                        inspector.role,
                    )
                    for inspector in report.inspectors
                )
                regulations.extend(
                    (report_id, rule.regulation, rule.title, rule.judgment)
                    for rule in report.regulations
                )
                items.extend(
                    (
                        report_id,
                        item.regulation,
                        item.requirement,
                        item.judgment,
                        item.risk_rating,
                        item.date_to_comply,
                    )
                    for item in report.compliance_items
                )
            if inspectors:
                cursor.executemany(_INSERT_INSPECTOR, inspectors)
            if regulations:
                cursor.executemany(_INSERT_REGULATION, regulations)
            if items:
                cursor.executemany(_INSERT_ITEM, items)
        return written


def _report_params(report: InspectionReport) -> Row:
    return (
        report.source_file_id,
        report.centre_id,
        report.centre_code,
        report.centre_name,
        report.provider_name,
        report.address,
        report.inspection_type,
        report.inspection_date,
        report.fieldwork_id,
        report.residents,
    )
