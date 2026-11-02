"""The pipeline's state kept in the bucket, for a task with an empty disk.

The checkpoint ``state/pipeline.json`` holds the schedule state and the exact
text of the manifests, so that their order, which decides the newest register
and price lists, survives. Raw files are restored from ``raw/``, where the
upload stage puts them.
"""

import json
import logging
from pathlib import Path

from clearcare_pipeline.object_store import ObjectStore
from clearcare_pipeline.price_lists.manifest import (
    MANIFEST_NAME as PRICE_LISTS_MANIFEST_NAME,
)
from clearcare_pipeline.raw_store import FileSystemRawStore
from clearcare_pipeline.reports.manifest import (
    MANIFEST_NAME as REPORTS_MANIFEST_NAME,
)
from clearcare_pipeline.snapshots.manifest import (
    MANIFEST_NAME as SNAPSHOTS_MANIFEST_NAME,
)
from clearcare_pipeline.upload.data_dir import RAW_PREFIX

CHECKPOINT_KEY = "state/pipeline.json"
VERSION = 1
MANIFEST_NAMES = (
    SNAPSHOTS_MANIFEST_NAME,
    REPORTS_MANIFEST_NAME,
    PRICE_LISTS_MANIFEST_NAME,
)

logger = logging.getLogger(__name__)


class BucketStateError(Exception):
    """The state in the bucket cannot be restored or saved."""


def restore(store: ObjectStore, data_dir: Path, state_path: Path) -> None:
    """Writes the checkpoint and every raw file into the data directory.

    Raises:
        BucketStateError: If the checkpoint is not valid, or a raw file does
            not match its hash.
        ObjectStoreError: If the checkpoint or a raw file cannot be read.
    """
    try:
        checkpoint = json.loads(store.get(CHECKPOINT_KEY))
        if checkpoint["version"] != VERSION:
            raise ValueError(f"version {checkpoint['version']!r}")
        schedule, manifests = checkpoint["schedule"], checkpoint["manifests"]
        for name, text in manifests.items():
            if name not in MANIFEST_NAMES or not isinstance(text, str):
                raise ValueError(f"{name!r} is not a manifest's name and text")
    except (ValueError, KeyError, TypeError, AttributeError) as error:
        raise BucketStateError(
            f"{CHECKPOINT_KEY} is not a checkpoint: {error}"
        ) from error
    (data_dir / "manifests").mkdir(parents=True, exist_ok=True)
    for name, text in manifests.items():
        (data_dir / "manifests" / name).write_bytes(text.encode())
    state_path.write_text(json.dumps(schedule), encoding="utf-8")

    raw = FileSystemRawStore(data_dir / "raw")
    keys = sorted(store.existing_keys(RAW_PREFIX))
    for key in keys:
        # The key ends in the SHA-256 of the content (ADR-0007).
        if raw.put(store.get(key)) != key.rsplit("/", 1)[-1]:
            raise BucketStateError(f"{key}: content does not match its hash")
    logger.info("restored %d raw files", len(keys))


def save(store: ObjectStore, data_dir: Path, state_path: Path) -> None:
    """Replaces the checkpoint with the schedule state and the manifests.

    Raises:
        ObjectStoreError: If the checkpoint was not written.
    """
    manifests = data_dir / "manifests"
    checkpoint = {
        "version": VERSION,
        "schedule": json.loads(state_path.read_text("utf-8")),
        "manifests": {
            name: (manifests / name).read_bytes().decode()
            for name in MANIFEST_NAMES
            if (manifests / name).exists()
        },
    }
    store.put(CHECKPOINT_KEY, json.dumps(checkpoint).encode())
