"""Entry point: ``python -m clearcare_pipeline.load_report_files``."""

import argparse
import logging
import sys
from collections.abc import Sequence
from pathlib import Path

import psycopg

from clearcare_pipeline.load_report_files.database import add_report_files
from clearcare_pipeline.reports.manifest import (
    MANIFEST_NAME,
    ManifestError,
    stored_report_files,
)

logger = logging.getLogger(__name__)


def main(argv: Sequence[str] | None = None) -> int:
    """Adds a source_file row for each stored report file not added yet.

    The database connection comes from libpq's environment variables
    (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD).
    """
    args = _parse_args(argv)
    manifest: Path = args.data_dir / "manifests" / MANIFEST_NAME
    # stored_report_files reads a missing manifest as empty, but here it
    # means --data-dir is wrong.
    if not manifest.is_file():
        logger.error("%s not found", manifest)
        return 1
    try:
        reports = stored_report_files(manifest)
    except ManifestError as error:
        logger.error("%s", error)
        return 1
    try:
        with psycopg.connect() as connection:
            added = add_report_files(connection, reports.values())
    except psycopg.Error as error:
        logger.error("database: %s", error)
        return 1
    logger.info(
        "%d report files added, %d already there", added, len(reports) - added
    )
    return 0


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Add the stored inspection report files to the database."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        required=True,
        help="directory that holds raw/ and manifests/",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    sys.exit(main())
