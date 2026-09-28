"""Uploading the raw files and snapshot records the bucket does not have."""

import hashlib
import json
import re
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from clearcare_pipeline.object_store import ObjectStore, ObjectStoreError
from clearcare_pipeline.snapshots.manifest import MANIFEST_NAME

RAW_PREFIX = "raw/"
MANIFEST_PREFIX = "manifests/register-snapshots/"
_SOURCE_NAME = re.compile(r"[a-z0-9_]+")


@dataclass(frozen=True)
class UploadReport:
    """What one upload run did."""

    uploaded: tuple[str, ...]
    already_present: int
    failed: tuple[str, ...]

    @property
    def ok(self) -> bool:
        """Whether everything local is now in the bucket."""
        return not self.failed


@dataclass(frozen=True)
class _Candidate:
    key: str
    load: Callable[[], bytes]
    expected_sha256: str | None = None


def upload_data_dir(data_dir: Path, store: ObjectStore) -> UploadReport:
    """Uploads every raw file and manifest record the bucket lacks.

    Objects are only ever added: the bucket's policy allows neither
    overwriting nor deleting, so anything already present is left alone.

    Raises:
        ObjectStoreError: If the bucket cannot be listed.
    """
    records, unreadable = _manifest_records(
        data_dir / "manifests" / MANIFEST_NAME
    )
    candidates = (*_raw_files(data_dir / "raw"), *records)
    existing = store.existing_keys(RAW_PREFIX) | store.existing_keys(
        MANIFEST_PREFIX
    )
    missing = tuple(item for item in candidates if item.key not in existing)
    outcomes = tuple((item.key, _upload(item, store)) for item in missing)
    return UploadReport(
        uploaded=tuple(key for key, problem in outcomes if problem is None),
        already_present=len(candidates) - len(missing),
        failed=(
            *unreadable,
            *(problem for _, problem in outcomes if problem is not None),
        ),
    )


def _raw_files(raw_root: Path) -> Iterator[_Candidate]:
    for path in sorted((raw_root / "sha256").glob("*/*")):
        if path.name.startswith(".") or not path.is_file():
            continue
        yield _Candidate(
            key=RAW_PREFIX + path.relative_to(raw_root).as_posix(),
            load=path.read_bytes,
            expected_sha256=path.name,
        )


def _manifest_records(
    manifest: Path,
) -> tuple[tuple[_Candidate, ...], tuple[str, ...]]:
    if not manifest.is_file():
        return (), ()
    lines = manifest.read_text(encoding="utf-8").splitlines()
    keyed = [
        (number, line, _record_key(line))
        for number, line in enumerate(lines, 1)
    ]
    return (
        tuple(
            _Candidate(key=key, load=_constant(line.encode()))
            for _, line, key in keyed
            if key is not None
        ),
        tuple(
            f"{manifest.name} line {number}: not a snapshot record"
            for number, _, key in keyed
            if key is None
        ),
    )


def _record_key(line: str) -> str | None:
    try:
        record = json.loads(line)
        fetched_at = datetime.fromisoformat(record["fetched_at"])
        source = record["source"]
    except (ValueError, KeyError, TypeError):
        return None
    if not isinstance(source, str) or not _SOURCE_NAME.fullmatch(source):
        return None
    stamp = fetched_at.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")
    return f"{MANIFEST_PREFIX}{stamp}_{source}.json"


def _constant(data: bytes) -> Callable[[], bytes]:
    return lambda: data


def _upload(item: _Candidate, store: ObjectStore) -> str | None:
    try:
        body = item.load()
    except OSError as error:
        return f"{item.key}: cannot read the local file ({error})"
    if (
        item.expected_sha256 is not None
        and hashlib.sha256(body).hexdigest() != item.expected_sha256
    ):
        return f"{item.key}: content does not match its hash"
    try:
        store.put(item.key, body)
    except ObjectStoreError as error:
        return str(error)
    return None
