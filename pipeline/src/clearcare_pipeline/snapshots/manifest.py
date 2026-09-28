"""The append-only manifest of snapshots."""

import json
from collections.abc import Iterable
from dataclasses import asdict
from pathlib import Path

from clearcare_pipeline.snapshots.snapshot import SnapshotRecord

MANIFEST_NAME = "register-snapshots.jsonl"


def append_records(path: Path, records: Iterable[SnapshotRecord]) -> None:
    """Appends each record to the manifest as one JSON line."""
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = "".join(
        json.dumps(asdict(record), sort_keys=True) + "\n" for record in records
    )
    with path.open("a", encoding="utf-8") as manifest:
        manifest.write(lines)
