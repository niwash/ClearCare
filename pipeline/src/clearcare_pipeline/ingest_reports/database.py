"""Writing transformed inspection reports to PostgreSQL."""

import logging
import uuid
from collections.abc import Sequence
from typing import Protocol

import psycopg
from psycopg.rows import TupleRow
from psycopg.types.json import Jsonb

from clearcare_pipeline.ingest_reports.models import (
    InspectionReport,
    ThematicReport,
)
from clearcare_pipeline.parser.text import ReportText

logger = logging.getLogger(__name__)

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

_INSERT_TEXT = (
    "INSERT INTO clearcare.inspection_report_text"
    " (report_id, kind, regulation, first_page, last_page, text,"
    " extractor_version, page_offsets)"
    " VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"
    " ON CONFLICT DO NOTHING"
)

_INSERT_THEMATIC = (
    "INSERT INTO clearcare.thematic_report"
    " (source_file_id, centre_id, centre_code, inspection_type,"
    " inspection_date, fieldwork_id, overall_judgment)"
    " VALUES (%s, %s, %s, %s, %s, %s, %s)"
    " ON CONFLICT DO NOTHING RETURNING id"
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

    def write_batch(
        self, reports: Sequence[InspectionReport | ThematicReport]
    ) -> int:
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
                "SELECT sha256 FROM clearcare.source_file"
                " JOIN clearcare.inspection_report USING (source_file_id)"
                " UNION"
                " SELECT sha256 FROM clearcare.source_file"
                " JOIN clearcare.thematic_report USING (source_file_id)"
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
    that is repeated adds nothing. The batch's transaction also writes the
    batch's alert events (CCARE-266), so a committed report is never without
    event coverage: one row per active package, its metadata the run's
    aggregate so far, replaced batch by batch. Thematic reports raise no
    alerts: the alerts follow published inspections.
    """

    def __init__(self, connection: Connection, version: str) -> None:
        """Creates a writer for this extractor version and its run identity."""
        self._connection = connection
        self._version = version
        # One task_uuid per ingest run: every event this writer writes, in
        # whatever batch, carries it.
        self._task_uuid = uuid.uuid4()
        # What the run has matched so far, held across batches: the centres
        # and counties it touched, distinct and in write order, and one
        # object per report pairing its centre with its county for the
        # all-reports package.
        self._centres: dict[str, None] = {}
        self._counties: dict[int, None] = {}
        self._reports: list[dict[str, object]] = []

    def write_batch(
        self, reports: Sequence[InspectionReport | ThematicReport]
    ) -> int:
        """Writes the batch in one transaction; returns how many were new."""
        inspectors: list[Row] = []
        regulations: list[Row] = []
        items: list[Row] = []
        text: list[Row] = []
        # The inspection reports this batch inserted, for the alert events.
        new_reports: list[tuple[int, str]] = []
        written = 0
        with (
            self._connection.transaction(),
            self._connection.cursor() as cursor,
        ):
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", (LOCK_KEY,))
            for report in reports:
                if isinstance(report, ThematicReport):
                    row = cursor.execute(
                        _INSERT_THEMATIC, _thematic_params(report)
                    ).fetchone()
                    if row is not None:
                        written += 1
                    continue
                row = cursor.execute(
                    _INSERT_REPORT, _report_params(report)
                ).fetchone()
                if row is None:
                    continue
                report_id = row[0]
                written += 1
                new_reports.append((report_id, report.centre_id))
                text.extend(_text_params(report_id, report.text, self._version))
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
            if text:
                cursor.executemany(_INSERT_TEXT, text)
            if new_reports:
                self._write_alert_events(cursor, new_reports)
        return written

    def write_text_batch(
        self,
        reports: Sequence[tuple[int, Sequence[ReportText]]],
    ) -> int:
        """Backfills complete extractions atomically, once per version."""
        written = 0
        with (
            self._connection.transaction(),
            self._connection.cursor() as cursor,
        ):
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", (LOCK_KEY,))
            for report_id, text in reports:
                loaded = cursor.execute(
                    "SELECT 1 FROM clearcare.inspection_report_text"
                    " WHERE report_id = %s AND extractor_version = %s LIMIT 1",
                    (report_id, self._version),
                ).fetchone()
                if loaded is not None:
                    continue
                cursor.executemany(
                    _INSERT_TEXT, _text_params(report_id, text, self._version)
                )
                written += 1
        return written

    def _write_alert_events(
        self,
        cursor: psycopg.Cursor[TupleRow],
        new_reports: Sequence[tuple[int, str]],
    ) -> None:
        """Writes the batch's alert events, inside the batch's transaction.

        Each active package gets one row for the run, its metadata shaped by
        what the package means: the centre package lists the centres the run
        touched, one object each; the county package the counties; the
        all-reports package one object per report pairing its centre with its
        county. A batch replaces the row's metadata with the run's aggregate so
        far, which the writer holds in memory, so the last batch leaves the
        whole run behind one row. A package whose list would be empty is not
        written, and a scope without a shape is logged and skipped, so a future
        package kind fails loudly rather than writing nonsense.
        """
        packages = cursor.execute(
            "SELECT id, scope FROM clearcare.alert_packages WHERE is_active"
            " ORDER BY id"
        ).fetchall()
        if not packages:
            logger.info("no active alert packages; no events written")
            return
        self._resolve_counties(cursor, new_reports)
        shapes = {
            "CENTRE": [{"centre_id": centre_id} for centre_id in self._centres],
            "COUNTY": [{"county_id": county} for county in self._counties],
            "ALL": self._reports,
        }
        written = 0
        for package_id, scope in packages:
            entries = shapes.get(str(scope))
            if entries is None:
                logger.warning(
                    "package scope %s has no event shape; no event for it",
                    scope,
                )
                continue
            if not entries:
                logger.info(
                    "package %s matched nothing in this run; no event", scope
                )
                continue
            cursor.execute(
                "INSERT INTO clearcare.alert_events"
                " (alert_package_id, task_uuid, status, metadata)"
                " VALUES (%s, %s, 'pending', %s)"
                " ON CONFLICT (alert_package_id, task_uuid) DO UPDATE"
                " SET metadata = EXCLUDED.metadata",
                (package_id, self._task_uuid, Jsonb(entries)),
            )
            written += 1
        logger.info(
            "%d alert events for run %s (%d new reports)",
            written,
            self._task_uuid,
            len(new_reports),
        )

    def _resolve_counties(
        self,
        cursor: psycopg.Cursor[TupleRow],
        new_reports: Sequence[tuple[int, str]],
    ) -> None:
        """Adds the batch's reports to the run's aggregate, counties resolved.

        The county comes from the centre's newest register entry, spelled as
        HIQA prints it and matched against the county table. A name the table
        does not hold is logged once and leaves that report without a county
        id, so an unexpected county never fails the ingest.
        """
        centre_ids = [centre_id for _, centre_id in new_reports]
        counties = {
            str(row[0]): int(row[1])
            for row in cursor.execute(
                "SELECT name, id FROM clearcare.county"
            ).fetchall()
        }
        latest = {
            str(row[0]): str(row[1])
            for row in cursor.execute(
                "SELECT DISTINCT ON (centre_id) centre_id, county"
                " FROM clearcare.register_entry WHERE centre_id = ANY(%s)"
                " ORDER BY centre_id, extracted_at DESC",
                (centre_ids,),
            ).fetchall()
        }
        for name in sorted(
            {county for county in latest.values() if county not in counties}
        ):
            logger.warning(
                "county %s is not in clearcare.county; no alerts can match it",
                name,
            )
        for _report_id, centre_id in new_reports:
            self._centres.setdefault(centre_id, None)
            county_name = latest.get(centre_id)
            county_id = (
                counties.get(county_name) if county_name is not None else None
            )
            self._reports.append(
                {"centre_id": centre_id, "county_id": county_id}
            )
            if county_id is not None:
                self._counties.setdefault(county_id, None)


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


def _thematic_params(report: ThematicReport) -> Row:
    return (
        report.source_file_id,
        report.centre_id,
        report.centre_code,
        report.inspection_type,
        report.inspection_date,
        report.fieldwork_id,
        report.overall_judgment,
    )


def _text_params(
    report_id: int,
    text: Sequence[ReportText],
    version: str,
) -> list[Row]:
    return [
        (
            report_id,
            row.kind,
            row.regulation,
            row.first_page,
            row.last_page,
            row.text,
            version,
            list(row.page_offsets),
        )
        for row in text
    ]
