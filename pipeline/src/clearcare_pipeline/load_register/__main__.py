"""Command line entry point: ``python -m clearcare_pipeline.load_register``."""

import argparse
import hashlib
import logging
import os
import sys
from collections.abc import Sequence
from pathlib import Path

import psycopg

from clearcare_pipeline.load_register.database import (
    SHRINK_LIMIT,
    LoadRefusedError,
    publish_snapshot,
)
from clearcare_pipeline.load_register.register_csv import (
    RegisterEntry,
    RegisterFileError,
    read_register,
)
from clearcare_pipeline.raw_store import FileSystemRawStore
from clearcare_pipeline.reports.register import (
    RegisterError,
    latest_register_download,
)
from clearcare_pipeline.snapshots.manifest import MANIFEST_NAME

# Set in the image when it is built (pipeline/Dockerfile).
VERSION_VARIABLE = "CLEARCARE_PIPELINE_VERSION"

logger = logging.getLogger(__name__)


def main(argv: Sequence[str] | None = None) -> int:
    """Loads the newest stored register snapshot and publishes it.

    The database connection comes from libpq's environment variables
    (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD).
    """
    args = _parse_args(argv)
    data_dir: Path = args.data_dir
    version = os.environ.get(VERSION_VARIABLE)
    if not version:
        logger.error("%s is not set", VERSION_VARIABLE)
        return 1
    try:
        download = latest_register_download(
            data_dir / "manifests" / MANIFEST_NAME
        )
    except RegisterError as error:
        logger.error("%s", error)
        return 1
    try:
        entries = _read_entries(data_dir, download.sha256)
    except (OSError, RegisterFileError) as error:
        logger.error("register snapshot %s: %s", download.sha256, error)
        return 1
    try:
        with psycopg.connect() as connection:
            loaded = publish_snapshot(
                connection,
                download,
                entries,
                version,
                allow_shrink=args.allow_shrink,
            )
    except LoadRefusedError as refusal:
        logger.error("refused: %s", refusal)
        return 1
    if loaded:
        logger.info("loaded %d centres from %s", len(entries), download.sha256)
    else:
        logger.info("%s is already loaded and published", download.sha256)
    return 0


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load the newest register snapshot into the database."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        required=True,
        help="directory that holds raw/ and manifests/",
    )
    parser.add_argument(
        "--allow-shrink",
        action="store_true",
        help=f"publish even if more than {SHRINK_LIMIT} centres left",
    )
    return parser.parse_args(argv)


def _read_entries(data_dir: Path, sha256: str) -> tuple[RegisterEntry, ...]:
    path = FileSystemRawStore(data_dir / "raw").path_for(sha256)
    content = path.read_bytes()
    if hashlib.sha256(content).hexdigest() != sha256:
        raise RegisterFileError("the stored file does not match its hash")
    return read_register(content)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    sys.exit(main())
