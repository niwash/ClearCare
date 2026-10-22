"""Command line entry point: ``python -m clearcare_pipeline.price_lists``."""

import argparse
import logging
import sys
import time
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from pathlib import Path

from clearcare_pipeline.contract_prices.run import SOURCES
from clearcare_pipeline.price_lists.manifest import MANIFEST_NAME
from clearcare_pipeline.price_lists.page import (
    PRICE_LISTS_PAGE,
    PriceListsPageError,
    find_price_lists,
)
from clearcare_pipeline.raw_store import FileSystemRawStore
from clearcare_pipeline.snapshots.fetch import (
    Fetcher,
    FetchError,
    UrllibFetcher,
)
from clearcare_pipeline.snapshots.run import run
from clearcare_pipeline.snapshots.sources import SnapshotSource

RETRY_WAITS_SECONDS = (60.0, 300.0)

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(UTC)


def main(
    argv: Sequence[str] | None = None,
    fetcher: Fetcher | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> int:
    """Downloads both HSE price lists into the data directory."""
    parser = argparse.ArgumentParser(
        description="Download the HSE contract price lists."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        required=True,
        help="directory that holds raw/ and manifests/",
    )
    data_dir: Path = parser.parse_args(argv).data_dir
    fetcher = fetcher or UrllibFetcher()
    try:
        page = fetcher.fetch(PRICE_LISTS_PAGE)
    except FetchError as error:
        logger.error("%s: %s", PRICE_LISTS_PAGE, error)
        return 1
    if page.status != 200 or not page.body:
        logger.error(
            "%s: HTTP %d, %d bytes",
            PRICE_LISTS_PAGE,
            page.status,
            len(page.body),
        )
        return 1
    try:
        urls = find_price_lists(page.body.decode("utf-8"), PRICE_LISTS_PAGE)
    except (UnicodeDecodeError, PriceListsPageError) as error:
        logger.error("%s: %s", PRICE_LISTS_PAGE, error)
        return 1
    # Named as the database names the stored file, so the manifest and
    # clearcare.source_file agree on what each download is.
    sources = [
        SnapshotSource(
            name=source,
            url=urls[home_type],
            media_type="application/pdf",
            signature=b"%PDF",
        )
        for home_type, source in SOURCES.items()
    ]
    return run(
        sources,
        fetcher,
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
