"""Command line entry point: ``python -m clearcare_pipeline.snapshots``."""

import argparse
import logging
import sys
import time
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from pathlib import Path

from clearcare_pipeline.raw_store import FileSystemRawStore
from clearcare_pipeline.snapshots.fetch import Fetcher, UrllibFetcher
from clearcare_pipeline.snapshots.run import run
from clearcare_pipeline.snapshots.sources import REGISTER_SOURCES

RETRY_WAITS_SECONDS = (60.0, 300.0)
MANIFEST_NAME = "register-snapshots.jsonl"


def _now() -> datetime:
    return datetime.now(UTC)


def main(
    argv: Sequence[str] | None = None,
    fetcher: Fetcher | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> int:
    """Snapshots every HIQA register into the data directory."""
    parser = argparse.ArgumentParser(
        description="Take a snapshot of every HIQA register."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        required=True,
        help="directory that holds raw/ and manifests/",
    )
    data_dir: Path = parser.parse_args(argv).data_dir
    return run(
        REGISTER_SOURCES,
        fetcher or UrllibFetcher(),
        FileSystemRawStore(data_dir / "raw"),
        data_dir / "manifests" / MANIFEST_NAME,
        _now,
        sleep,
        RETRY_WAITS_SECONDS,
    )


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    sys.exit(main())
