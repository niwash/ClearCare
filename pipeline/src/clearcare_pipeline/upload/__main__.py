"""Command line entry point: ``python -m clearcare_pipeline.upload``."""

import argparse
import logging
import os
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path

from clearcare_pipeline.object_store import (
    ObjectStore,
    ObjectStoreError,
    S3ObjectStore,
)
from clearcare_pipeline.s3_settings import (
    S3Settings,
    SettingsError,
    make_s3_client,
)
from clearcare_pipeline.upload.data_dir import upload_data_dir

EXIT_SETTINGS_ERROR = 2

logger = logging.getLogger(__name__)


def main(
    argv: Sequence[str] | None = None,
    env: Mapping[str, str] | None = None,
    store: ObjectStore | None = None,
) -> int:
    """Uploads what the bucket lacks from the data directory."""
    parser = argparse.ArgumentParser(
        description="Copy raw files and manifest records to object storage."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        required=True,
        help="directory that holds raw/ and manifests/",
    )
    data_dir: Path = parser.parse_args(argv).data_dir
    try:
        target = store or _store_from(os.environ if env is None else env)
    except SettingsError as error:
        logger.error("%s", error)
        return EXIT_SETTINGS_ERROR
    try:
        report = upload_data_dir(data_dir, target)
    except ObjectStoreError as error:
        logger.error("%s", error)
        return 1
    logger.info(
        "uploaded %d, already present %d, failed %d",
        len(report.uploaded),
        report.already_present,
        len(report.failed),
    )
    for problem in report.failed:
        logger.error("%s", problem)
    return 0 if report.ok else 1


def _store_from(env: Mapping[str, str]) -> ObjectStore:
    settings = S3Settings.from_env(env)
    return S3ObjectStore(make_s3_client(settings), settings.bucket)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    sys.exit(main())
