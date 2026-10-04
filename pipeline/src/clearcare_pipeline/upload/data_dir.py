"""Uploading the raw files and manifest records the bucket does not have."""

import hashlib
import json
import re
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from clearcare_pipeline.object_store import ObjectStore, ObjectStoreError
from clearcare_pipeline.reports.manifest import (
    MANIFEST_NAME as REPORTS_MANIFEST_NAME,
)
from clearcare_pipeline.snapshots.manifest import (
    MANIFEST_NAME as SNAPSHOTS_MANIFEST_NAME,
)

RAW_PREFIX = "raw/"
MANIFESTS_PREFIX = "manifests/"
_RECORD_ID = re.compile(r"[a-z0-9_]+")


@dataclass(frozen=True)
class _Manifest:
    """A local manifest whose lines are each uploaded as one object.

    Attributes:
        file_name: The manifest's name in the data dir's manifests/.
        prefix: Where its lines go in the bucket.
        id_field: The record field that, with fetched_at, names the object.
        record: What a line holds, for error messages.
    """

    file_name: str
    prefix: str
    id_field: str
    record: str


_MANIFESTS = (
    _Manifest(
        file_name=SNAPSHOTS_MANIFEST_NAME,
        prefix="manifests/register-snapshots/",
        id_field="source",
        record="snapshot record",
    ),
    _Manifest(
        file_name=REPORTS_MANIFEST_NAME,
        prefix="manifests/inspection-reports/",
        id_field="centre_id",
        record="centre record",
    ),
)


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
    manifests = [
        _manifest_records(data_dir / "manifests", manifest)
        for manifest in _MANIFESTS
    ]
    records = [record for found, _ in manifests for record in found]
    unreadable = [problem for _, problems in manifests for problem in problems]
    candidates = (*_raw_files(data_dir / "raw"), *records)
    existing = store.existing_keys(RAW_PREFIX) | store.existing_keys(
        MANIFESTS_PREFIX
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
    manifests_dir: Path, manifest: _Manifest
) -> tuple[tuple[_Candidate, ...], tuple[str, ...]]:
    path = manifests_dir / manifest.file_name
    if not path.is_file():
        return (), ()
    lines = path.read_text(encoding="utf-8").splitlines()
    keyed = [
        (number, line, _record_key(line, manifest))
        for number, line in enumerate(lines, 1)
    ]
    return (
        tuple(
            _Candidate(key=key, load=_constant(line.encode()))
            for _, line, key in keyed
            if key is not None
        ),
        tuple(
            f"{manifest.file_name} line {number}: not a {manifest.record}"
            for number, _, key in keyed
            if key is None
        ),
    )


def _record_key(line: str, manifest: _Manifest) -> str | None:
    try:
        record = json.loads(line)
        fetched_at = datetime.fromisoformat(record["fetched_at"])
        record_id = record[manifest.id_field]
    except (ValueError, KeyError, TypeError):
        return None
    if not isinstance(record_id, str) or not _RECORD_ID.fullmatch(record_id):
        return None
    stamp = fetched_at.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")
    return f"{manifest.prefix}{stamp}_{record_id}.json"


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
