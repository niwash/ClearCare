"""Command line entry point: ``python -m clearcare_pipeline.ingest_reports``.

Reads reports from a file list or an object-store prefix, and writes them to
the database a batch at a time. The parsing and writing live in run.py.
"""

import argparse
import logging
import os
import sys
from collections.abc import Iterator, Sequence
from pathlib import Path

import psycopg

from clearcare_pipeline.ingest_reports import database, sources
from clearcare_pipeline.ingest_reports.run import ingest, parse_report
from clearcare_pipeline.ingest_reports.sources import Source
from clearcare_pipeline.object_store import S3ObjectStore
from clearcare_pipeline.s3_settings import S3Settings, make_s3_client

DEFAULT_BATCH_SIZE = 50
PARSER_DIR = Path(__file__).resolve().parents[1] / "parser"
DEFAULT_MAPPER = PARSER_DIR / "mapper.csv"
DEFAULT_FIELDS = PARSER_DIR / "fields.csv"

logger = logging.getLogger(__name__)


def main(argv: Sequence[str] | None = None) -> int:
    """Runs the ingest from the command line.

    The database connection comes from libpq's environment variables
    (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD). The object store, when
    a prefix is given, comes from the CLEARCARE_S3_* variables.
    """
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    try:
        source = _source(args)
        # autocommit: the writer commits each batch in its own transaction.
        with psycopg.connect(autocommit=True) as connection:
            # The catalogue is read once, before the first batch is written.
            catalogue = database.DatabaseCatalogue(connection)
            writer = database.ReportWriter(connection)
            summary = ingest(
                source,
                catalogue,
                writer,
                parse=lambda body: parse_report(body, args.mapper, args.fields),
                batch_size=args.batch_size,
            )
    except psycopg.Error as error:
        logger.error("database error: %s", error)
        return 1
    logger.info(
        "parsed %d, wrote %d, skipped %d, failed %d",
        summary.parsed,
        summary.written,
        summary.skipped,
        summary.failed,
    )
    return 0 if summary.failed == 0 else 1


def _source(args: argparse.Namespace) -> Iterator[Source]:
    """Returns the reports to ingest, from the prefix or the file list."""
    if args.prefix is not None:
        settings = S3Settings.from_env(os.environ)
        store = S3ObjectStore(make_s3_client(settings), settings.bucket)
        return sources.from_prefix(store, args.prefix)
    return sources.from_paths(args.report)


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ingest parsed HIQA inspection reports into the database."
    )
    parser.add_argument(
        "--batch-size",
        type=_positive_int,
        default=DEFAULT_BATCH_SIZE,
        help=f"reports per database write (default: {DEFAULT_BATCH_SIZE})",
    )
    parser.add_argument(
        "--report",
        type=Path,
        action="append",
        default=[],
        metavar="PATH",
        help="a report file; repeat the option for several",
    )
    parser.add_argument(
        "--prefix",
        metavar="PREFIX",
        help="an object-store key prefix holding the reports",
    )
    parser.add_argument(
        "--mapper",
        type=Path,
        default=DEFAULT_MAPPER,
        help="the CSV section mapping (default: the parser's own)",
    )
    parser.add_argument(
        "--fields",
        type=Path,
        default=DEFAULT_FIELDS,
        help="the CSV value mapping (default: the parser's own)",
    )
    args = parser.parse_args(argv)
    if (args.prefix is None) == (not args.report):
        parser.error("give exactly one of --report and --prefix")
    return args


def _positive_int(value: str) -> int:
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError(f"must be 1 or more, not {number}")
    return number


if __name__ == "__main__":
    sys.exit(main())
