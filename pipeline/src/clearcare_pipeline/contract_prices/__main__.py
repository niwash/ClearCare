"""Ingesting contract price lists from the command line."""

import argparse
import logging
import sys
from collections.abc import Sequence
from pathlib import Path

import psycopg

from clearcare_pipeline.contract_prices import database
from clearcare_pipeline.contract_prices.run import (
    PriceListFile,
    ingest,
    parse_price_list,
)

PARSER_DIR = Path(__file__).resolve().parents[1] / "parser"
DEFAULT_MAPPER = PARSER_DIR / "contract_price_mapper.csv"

logger = logging.getLogger(__name__)


def main(argv: Sequence[str] | None = None) -> int:
    """Runs the ingest from the command line.

    Each option gives the list's PDF and the page it was published on, which
    is stored beside it.
    """
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    try:
        # autocommit: the writer commits each list in its own transaction.
        with psycopg.connect(autocommit=True) as connection:
            # The catalogue is read once, before the first list is written.
            catalogue = database.DatabaseCatalogue(connection)
            writer = database.PriceListWriter(connection)
            summary = ingest(
                _files(args),
                catalogue,
                writer,
                parse=lambda body, home_type: parse_price_list(
                    body, home_type, args.mapper, PARSER_DIR
                ),
            )
    except psycopg.Error as error:
        logger.error("database error: %s", error)
        return 1
    logger.info(
        "parsed %d lists, wrote %d, already loaded %d, %d prices,"
        " skipped %d, failed %d",
        summary.parsed,
        summary.written,
        summary.already_loaded,
        summary.prices,
        summary.skipped,
        summary.failed,
    )
    return 0 if summary.failed == 0 else 1


def _files(args: argparse.Namespace) -> list[PriceListFile]:
    """Returns the lists to ingest, from the options that were given."""
    files: list[PriceListFile] = []
    for home_type, option in (
        ("public", args.public),
        ("private", args.private),
    ):
        if option is None:
            continue
        path, url = option
        files.append(PriceListFile(home_type, url, Path(path)))
    return files


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ingest HSE contract price lists into the database."
    )
    parser.add_argument(
        "--public",
        nargs=2,
        metavar=("PATH", "URL"),
        help="the public list's PDF, and the page it was published on",
    )
    parser.add_argument(
        "--private",
        nargs=2,
        metavar=("PATH", "URL"),
        help="the private list's PDF, and the page it was published on",
    )
    parser.add_argument(
        "--mapper",
        type=Path,
        default=DEFAULT_MAPPER,
        help="the CSV section mapping (default: the parser's own)",
    )
    args = parser.parse_args(argv)
    if args.public is None and args.private is None:
        parser.error("give --public, --private, or both")
    return args


if __name__ == "__main__":
    sys.exit(main())
