"""Backfill report text: python -m clearcare_pipeline.extract_text."""

import argparse
import logging
import sys
from collections.abc import Sequence
from pathlib import Path

import psycopg
import pymupdf

from clearcare_pipeline.ingest_reports.__main__ import (
    DEFAULT_BATCH_SIZE,
    DEFAULT_FIELDS,
    DEFAULT_MAPPER,
    positive_int,
)
from clearcare_pipeline.ingest_reports.database import Connection, ReportWriter
from clearcare_pipeline.ingest_reports.run import Summary, parse_report
from clearcare_pipeline.ingest_reports.sources import read_stored_report
from clearcare_pipeline.parser.text import EXTRACTOR_VERSION, ReportText
from clearcare_pipeline.raw_store import FileSystemRawStore

logger = logging.getLogger(__name__)


def backfill(
    connection: Connection,
    data_dir: Path,
    version: str,
    *,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> Summary:
    """Writes text for reports with no extraction at this version.

    The database supplies the PDF hashes, including reports absent from the
    latest download manifest; missing or altered files fail visibly.
    """
    pending = connection.execute(
        "SELECT r.id, s.sha256, s.url FROM clearcare.inspection_report r"
        " JOIN clearcare.source_file s USING (source_file_id)"
        " WHERE NOT EXISTS (SELECT 1 FROM clearcare.inspection_report_text t"
        " WHERE t.report_id = r.id AND t.extractor_version = %s)"
        " ORDER BY r.id",
        (version,),
    ).fetchall()
    store = FileSystemRawStore(data_dir / "raw")
    writer = ReportWriter(connection, version)
    buffer: list[tuple[int, Sequence[ReportText]]] = []
    parsed = written = failed = 0
    for report_id, digest, url in pending:
        source = read_stored_report(store, str(url), str(digest))
        try:
            if source.error:
                raise ValueError(source.error)
            report = parse_report(source.body, DEFAULT_MAPPER, DEFAULT_FIELDS)
        except (ValueError, pymupdf.FileDataError) as error:
            logger.error("report %s (%s): %s", report_id, url, error)
            failed += 1
            continue
        parsed += 1
        for regulation, reason in report.missing_responses:
            logger.warning(
                "report %s (%s), %s: %s", report_id, url, regulation, reason
            )
        failed += bool(report.missing_responses)
        buffer.append((int(report_id), report.text))
        if len(buffer) >= batch_size:
            written += writer.write_text_batch(buffer)
            logger.info("text batch written (%d reports so far)", written)
            buffer.clear()
    if buffer:
        written += writer.write_text_batch(buffer)
    # Reports that already had text at this version keep their omissions
    # visible on repeat backfills; the reason was logged when they were cut.
    missing = connection.execute(
        "SELECT r.id, s.url, g.regulation FROM clearcare.inspection_report r"
        " JOIN clearcare.source_file s USING (source_file_id)"
        " JOIN clearcare.inspection_regulation g ON g.report_id = r.id"
        " WHERE lower(g.judgment) <> 'compliant'"
        " AND EXISTS (SELECT 1 FROM clearcare.inspection_report_text t"
        " WHERE t.report_id = r.id AND t.extractor_version = %s)"
        " AND NOT EXISTS (SELECT 1 FROM clearcare.inspection_report_text t"
        " WHERE t.report_id = r.id AND t.extractor_version = %s"
        " AND t.kind = 'response' AND t.regulation = g.regulation)"
        " AND r.id <> ALL(%s)"
        " ORDER BY r.id, g.regulation",
        (version, version, [int(row[0]) for row in pending]),
    ).fetchall()
    for report_id, url, regulation in missing:
        logger.warning(
            "report %s (%s), %s: no response stored",
            report_id,
            url,
            regulation,
        )
    failed += len({row[0] for row in missing})
    return Summary(parsed, written, 0, 0, failed)


def main(argv: Sequence[str] | None = None) -> int:
    """Backfills from the local raw store, connecting through libpq settings."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument(
        "--batch-size", type=positive_int, default=DEFAULT_BATCH_SIZE
    )
    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    try:
        with psycopg.connect(autocommit=True) as connection:
            summary = backfill(
                connection,
                args.data_dir,
                EXTRACTOR_VERSION,
                batch_size=args.batch_size,
            )
    except (psycopg.Error, OSError) as error:
        logger.error("%s", error)
        return 1
    logger.info(
        "parsed %d, wrote %d, failed %d",
        summary.parsed,
        summary.written,
        summary.failed,
    )
    return int(summary.failed > 0)


if __name__ == "__main__":
    sys.exit(main())
