"""Command line entry point: ``python -m clearcare_pipeline.reports``."""

import argparse
import logging
import sys
import time
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from pathlib import Path

from clearcare_pipeline.raw_store import FileSystemRawStore
from clearcare_pipeline.reports.download import (
    SpacedFetcher,
    download_reports,
)
from clearcare_pipeline.reports.manifest import MANIFEST_NAME, ManifestError
from clearcare_pipeline.reports.register import (
    RegisterError,
    centres_in_county,
    latest_register_sha256,
)
from clearcare_pipeline.snapshots.fetch import Fetcher, UrllibFetcher
from clearcare_pipeline.snapshots.manifest import (
    MANIFEST_NAME as SNAPSHOT_MANIFEST_NAME,
)

GAP_SECONDS = 3.0
RETRY_WAITS_SECONDS = (60.0, 300.0)

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(UTC)


def _positive_int(value: str) -> int:
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError(f"must be 1 or more, not {number}")
    return number


def main(
    argv: Sequence[str] | None = None,
    fetcher: Fetcher | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> int:
    """Downloads the reports of one county's centres into the data dir."""
    parser = argparse.ArgumentParser(
        description="Download the inspection reports of a county's centres."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        required=True,
        help="directory that holds raw/ and manifests/",
    )
    parser.add_argument(
        "--county", required=True, help="County as the register spells it"
    )
    parser.add_argument(
        "--limit",
        type=_positive_int,
        help="only the first N centres, in register order",
    )
    args = parser.parse_args(argv)
    data_dir: Path = args.data_dir
    store = FileSystemRawStore(data_dir / "raw")
    try:
        register = latest_register_sha256(
            data_dir / "manifests" / SNAPSHOT_MANIFEST_NAME
        )
        centres = centres_in_county(
            store.path_for(register).read_bytes(), args.county
        )
    except (RegisterError, OSError) as error:
        logger.error("cannot read the register: %s", error)
        return 1
    if not centres:
        logger.error("no centres in county %r", args.county)
        return 1
    try:
        summary = download_reports(
            centres[: args.limit],
            SpacedFetcher(
                # A redirect could lead to HIQA's verified routes, or to
                # another host, without the gap between requests.
                fetcher or UrllibFetcher(follow_redirects=False),
                GAP_SECONDS,
                time.monotonic,
                sleep,
            ),
            store,
            data_dir / "manifests" / MANIFEST_NAME,
            _now,
            sleep,
            RETRY_WAITS_SECONDS,
        )
    except ManifestError as error:
        logger.error("%s", error)
        return 1
    logger.info(
        "%d centres, %d reports listed, %d downloaded (%d bytes), "
        "%d already stored",
        summary.centres,
        summary.reports_listed,
        summary.downloaded,
        summary.downloaded_bytes,
        summary.already_stored,
    )
    return 0 if summary.failure is None else 1


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    sys.exit(main())
