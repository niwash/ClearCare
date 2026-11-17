"""Entry point: ``python -m clearcare_pipeline.register_changes``."""

import argparse
import logging
import sys
from collections.abc import Sequence
from pathlib import Path

import psycopg

from clearcare_pipeline.exit_codes import EXIT_DONE, EXIT_FAILED
from clearcare_pipeline.load_register.register_csv import (
    RegisterEntry,
    RegisterFileError,
    read_stored_register,
)
from clearcare_pipeline.register_changes.database import append_changes
from clearcare_pipeline.register_changes.differ import (
    RegisterChange,
    register_changes,
)
from clearcare_pipeline.reports.register import (
    RegisterDownload,
    RegisterError,
    register_downloads,
)
from clearcare_pipeline.snapshots.manifest import MANIFEST_NAME

logger = logging.getLogger(__name__)


def main(argv: Sequence[str] | None = None) -> int:
    """Adds the changes of the stored register snapshots not added yet.

    Every run compares every stored snapshot again, as each run has them all
    in its data directory. The first run after a deployment so adds the
    history, and a later one the changes of the day (ADR-0031).

    The database connection comes from libpq's environment variables
    (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD).
    """
    args = _parse_args(argv)
    data_dir: Path = args.data_dir
    manifest = data_dir / "manifests" / MANIFEST_NAME
    # register_downloads reads a missing manifest as empty, but here it
    # means --data-dir is wrong.
    if not manifest.is_file():
        logger.error("%s not found", manifest)
        return EXIT_FAILED
    try:
        downloads = register_downloads(manifest)
    except RegisterError as error:
        logger.error("%s", error)
        return EXIT_FAILED
    changes = stored_changes(data_dir, downloads)
    try:
        with psycopg.connect() as connection:
            added = append_changes(connection, changes)
    except psycopg.Error as error:
        logger.error("database: %s", error)
        return EXIT_FAILED
    logger.info("%d register changes found, %d added", len(changes), added)
    return EXIT_DONE


def stored_changes(
    data_dir: Path, downloads: Sequence[RegisterDownload]
) -> list[RegisterChange]:
    """Returns the changes of the stored snapshots, oldest snapshot first.

    A centre is compared with its entry in the last snapshot that had it, so
    a centre missing from one snapshot is not registered again when it is
    back.

    Args:
        data_dir: The directory that holds raw/.
        downloads: The register's downloads, in manifest order.
    """
    last_seen: dict[str, RegisterEntry] = {}
    changes: list[RegisterChange] = []
    for download in downloads:
        try:
            entries = read_stored_register(data_dir, download.sha256)
        except (OSError, RegisterFileError) as error:
            # Not the run's failure: the snapshots around it still compare,
            # and the newest one failing is already load_register's error.
            logger.warning(
                "register snapshot %s passed over: %s", download.sha256, error
            )
            continue
        for entry in entries:
            changes.extend(
                register_changes(
                    last_seen.get(entry.centre_id), entry, download
                )
            )
            last_seen[entry.centre_id] = entry
    return changes


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Add what changed on the register to the database."
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
