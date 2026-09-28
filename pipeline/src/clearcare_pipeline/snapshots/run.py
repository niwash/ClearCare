"""Snapshotting every source, with retries."""

import dataclasses
import logging
from collections.abc import Callable, Sequence
from datetime import datetime
from pathlib import Path

from clearcare_pipeline.raw_store import RawStore
from clearcare_pipeline.snapshots.fetch import Fetcher
from clearcare_pipeline.snapshots.manifest import append_records
from clearcare_pipeline.snapshots.snapshot import SnapshotRecord, take_snapshot
from clearcare_pipeline.snapshots.sources import SnapshotSource

logger = logging.getLogger(__name__)


def snapshot_with_retries(
    source: SnapshotSource,
    fetcher: Fetcher,
    store: RawStore,
    now: Callable[[], datetime],
    sleep: Callable[[float], None],
    waits: Sequence[float],
) -> SnapshotRecord:
    """Takes a snapshot, waiting and retrying after each failed attempt."""
    record = take_snapshot(source, fetcher, store, now)
    for attempt, wait in enumerate(waits, start=2):
        if record.ok:
            break
        logger.warning(
            "%s: attempt %d failed (%s); retrying in %.0f s",
            source.name,
            attempt - 1,
            record.error,
            wait,
        )
        sleep(wait)
        record = dataclasses.replace(
            take_snapshot(source, fetcher, store, now), attempts=attempt
        )
    return record


def run(
    sources: Sequence[SnapshotSource],
    fetcher: Fetcher,
    store: RawStore,
    manifest: Path,
    now: Callable[[], datetime],
    sleep: Callable[[float], None],
    waits: Sequence[float],
) -> int:
    """Snapshots every source and returns a process exit code.

    Each record is appended to the manifest as soon as its source is done,
    so a crash part-way through keeps the records already taken.
    """
    all_ok = True
    for source in sources:
        record = snapshot_with_retries(
            source, fetcher, store, now, sleep, waits
        )
        append_records(manifest, [record])
        if record.ok:
            logger.info(
                "%s: stored %s (%d bytes)",
                record.source,
                record.sha256,
                record.size or 0,
            )
        else:
            all_ok = False
            logger.error(
                "%s: failed after %d attempts (%s)",
                record.source,
                record.attempts,
                record.error,
            )
    return 0 if all_ok else 1
