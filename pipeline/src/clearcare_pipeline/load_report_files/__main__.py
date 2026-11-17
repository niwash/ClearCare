"""Entry point: ``python -m clearcare_pipeline.load_report_files``."""

import argparse
import logging
import sys
from collections.abc import Sequence
from pathlib import Path

import psycopg

from clearcare_pipeline.load_report_files.database import (
    add_report_files,
    record_page_checks,
    store_listed_reports,
)
from clearcare_pipeline.reports.manifest import (
    MANIFEST_NAME,
    ManifestError,
    last_page_checks,
    listed_reports,
    stored_report_files,
)

logger = logging.getLogger(__name__)


def main(argv: Sequence[str] | None = None) -> int:
    """Adds a source_file row for each stored report file not added yet.

    It also stores when each centre's page was last read, so the site can say
    when ClearCare last looked on hiqa.ie for a new report (db/V18), and the
    reports the page listed, whether or not their files are stored (db/V22).

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
        checks = last_page_checks(manifest)
        listed = listed_reports(manifest)
    except ManifestError as error:
        logger.error("%s", error)
        return 1
    try:
        with psycopg.connect() as connection:
            added = add_report_files(connection, reports.values())
            checked = record_page_checks(connection, checks)
            changed = store_listed_reports(connection, listed)
    except psycopg.Error as error:
        logger.error("database: %s", error)
        return 1
    logger.info(
        "%d report files added, %d already there", added, len(reports) - added
    )
    logger.info("%d of %d centre page checks stored", checked, len(checks))
    logger.info(
        "%d of %d listed reports added or changed",
        changed,
        sum(len(reports) for reports in listed.values()),
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
