"""Append commitments: python -m clearcare_pipeline.split_commitments."""

import argparse
import logging
import sys
from bisect import bisect_right
from collections.abc import Sequence

import psycopg

from clearcare_pipeline.ingest_reports.database import LOCK_KEY, Connection
from clearcare_pipeline.ingest_reports.run import Summary
from clearcare_pipeline.parser.commitments import VERSION, split

logger = logging.getLogger(__name__)


def backfill(connection: Connection) -> Summary:
    """Splits stored text and page offsets once per row and splitter version."""
    pending = connection.execute(
        "SELECT t.id, t.report_id, t.regulation, t.text, t.first_page,"
        " t.page_offsets FROM clearcare.inspection_report_text t"
        " WHERE t.kind = 'response' AND NOT EXISTS"
        " (SELECT 1 FROM clearcare.inspection_commitment c"
        " WHERE c.response_id = t.id AND c.splitter_version = %s)"
        " ORDER BY t.report_id, t.id",
        (VERSION,),
    ).fetchall()
    written = failed = 0
    for (
        response_id,
        report_id,
        regulation,
        text,
        first,
        offsets,
    ) in pending:
        try:
            commitments = split(text)
            with connection.transaction(), connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_xact_lock(%s)", (LOCK_KEY,))
                loaded = cursor.execute(
                    "SELECT 1 FROM clearcare.inspection_commitment"
                    " WHERE response_id = %s AND splitter_version = %s LIMIT 1",
                    (response_id, VERSION),
                ).fetchone()
                if loaded:
                    continue
                cursor.executemany(
                    "INSERT INTO clearcare.inspection_commitment"
                    " (response_id, sub_regulation, start_offset, end_offset,"
                    " text, stated_deadline, stated_deadline_text,"
                    " deadline_precision, page, last_page, splitter_version)"
                    " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                    [
                        (
                            response_id,
                            row.sub_regulation,
                            row.start_offset,
                            row.end_offset,
                            row.text,
                            row.stated_deadline,
                            row.stated_deadline_text,
                            row.deadline_precision,
                            first + bisect_right(offsets, row.start_offset),
                            first + bisect_right(offsets, row.end_offset - 1),
                            VERSION,
                        )
                        for row in commitments
                    ],
                )
            written += 1
        except ValueError as error:
            logger.error(
                "report %s, %s (response %s): %s",
                report_id,
                regulation,
                response_id,
                error,
            )
            failed += 1
    return Summary(len(pending), written, 0, 0, failed)


def main(argv: Sequence[str] | None = None) -> int:
    """Connects through libpq settings and exits nonzero on failed responses."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args(argv)
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    try:
        with psycopg.connect(autocommit=True) as connection:
            summary = backfill(connection)
    except psycopg.Error as error:
        logger.error("%s", error)
        return 1
    logger.info(
        "responses %d, wrote %d, failed %d",
        summary.parsed,
        summary.written,
        summary.failed,
    )
    return int(summary.failed > 0)


if __name__ == "__main__":
    sys.exit(main())
