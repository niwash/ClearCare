"""Backfill the About section: python -m clearcare_pipeline.extract_about."""

import argparse
import logging
import sys
import tempfile
from collections.abc import Sequence
from pathlib import Path

import psycopg
import pymupdf

from clearcare_pipeline.ingest_reports.__main__ import (
    DEFAULT_BATCH_SIZE,
    DEFAULT_MAPPER,
    positive_int,
)
from clearcare_pipeline.ingest_reports.database import Connection, ReportWriter
from clearcare_pipeline.ingest_reports.run import Summary
from clearcare_pipeline.ingest_reports.sources import read_stored_report
from clearcare_pipeline.parser.about import ABOUT_VERSION, extract_about
from clearcare_pipeline.parser.parser import Parser
from clearcare_pipeline.parser.text import ReportText
from clearcare_pipeline.raw_store import FileSystemRawStore

logger = logging.getLogger(__name__)


def backfill(
    connection: Connection,
    data_dir: Path,
    *,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> Summary:
    """Writes the About section of reports that have none at this version.

    The database supplies the PDF hashes; a missing or altered file, or a
    report with no About section, fails visibly and is tried again next run.
    """
    pending = connection.execute(
        "SELECT r.id, s.sha256, s.url FROM clearcare.inspection_report r"
        " JOIN clearcare.source_file s USING (source_file_id)"
        " WHERE NOT EXISTS (SELECT 1 FROM clearcare.inspection_report_text t"
        " WHERE t.report_id = r.id AND t.extractor_version = %s"
        " AND t.kind = 'about')"
        " ORDER BY r.id",
        (ABOUT_VERSION,),
    ).fetchall()
    store = FileSystemRawStore(data_dir / "raw")
    writer = ReportWriter(connection, ABOUT_VERSION)
    buffer: list[tuple[int, Sequence[ReportText]]] = []
    parsed = written = failed = 0
    for report_id, digest, url in pending:
        source = read_stored_report(store, str(url), str(digest))
        try:
            if source.error:
                raise ValueError(source.error)
            about = _about(source.body)
        except (ValueError, pymupdf.FileDataError) as error:
            logger.error("report %s (%s): %s", report_id, url, error)
            failed += 1
            continue
        parsed += 1
        buffer.append((int(report_id), [about]))
        if len(buffer) >= batch_size:
            written += writer.write_text_batch(buffer)
            logger.info("about batch written (%d reports so far)", written)
            buffer.clear()
    if buffer:
        written += writer.write_text_batch(buffer)
    return Summary(parsed, written, 0, 0, failed)


def _about(body: bytes) -> ReportText:
    """Reads the section from a PDF's bytes, through a temporary file."""
    with tempfile.NamedTemporaryFile(suffix=".pdf") as handle:
        handle.write(body)
        handle.flush()
        sections = Parser(Path(handle.name), DEFAULT_MAPPER).parse()
    about = extract_about(sections.get("about", ()))
    if about is None:
        raise ValueError("no About the designated centre text found")
    return about


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
                connection, args.data_dir, batch_size=args.batch_size
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
