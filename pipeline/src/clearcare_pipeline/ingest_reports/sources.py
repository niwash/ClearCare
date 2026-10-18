"""The reports to ingest, from a file list, a store prefix or a data dir."""

import hashlib
import logging
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from pathlib import Path

from clearcare_pipeline.object_store import ObjectStore
from clearcare_pipeline.raw_store import FileSystemRawStore
from clearcare_pipeline.reports.manifest import (
    MANIFEST_NAME,
    ManifestError,
    stored_report_files,
)

PDF_SIGNATURE = b"%PDF"

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Source:
    """One report to parse: a name for the logs, and its bytes.

    error says why the bytes could not be read; body is then empty.
    """

    name: str
    body: bytes
    error: str | None = None


def from_paths(paths: Sequence[Path]) -> Iterator[Source]:
    """Yields each file's bytes, in the order given."""
    for path in paths:
        yield Source(name=str(path), body=path.read_bytes())


def from_prefix(store: ObjectStore, prefix: str) -> Iterator[Source]:
    """Yields each PDF under a store prefix, in key order.

    Objects that are not PDFs are skipped, so a prefix that holds the whole
    raw store (its HTML pages and register CSV as well) works.
    """
    for key in sorted(store.existing_keys(prefix)):
        body = store.get(key)
        if not body.startswith(PDF_SIGNATURE):
            logger.info("skipping %s: not a PDF", key)
            continue
        yield Source(name=key, body=body)


def from_data_dir(data_dir: Path) -> Iterator[Source]:
    """Yields each stored report file once, as the reports manifest lists it.

    A file that is missing or does not match its hash comes with an error.

    Raises:
        ManifestError: If the manifest is missing or a line is unreadable.
    """
    manifest = data_dir / "manifests" / MANIFEST_NAME
    # stored_report_files reads a missing manifest as empty, but here it
    # means --data-dir is wrong.
    if not manifest.is_file():
        raise ManifestError(f"{manifest} not found")
    # A file downloaded under two names is ingested once.
    names = {
        report.sha256: report.file_name
        for report in stored_report_files(manifest).values()
        if report.sha256
    }
    store = FileSystemRawStore(data_dir / "raw")
    return (
        read_stored_report(store, name, sha256)
        for sha256, name in names.items()
    )


def read_stored_report(
    store: FileSystemRawStore,
    name: str,
    sha256: str,
) -> Source:
    """Reads one content-addressed PDF and verifies its stored hash."""
    try:
        body = store.path_for(sha256).read_bytes()
    except OSError as error:
        return Source(name=name, body=b"", error=f"raw file: {error}")
    if hashlib.sha256(body).hexdigest() != sha256:
        error = f"raw file {sha256} does not match its hash"
        return Source(name=name, body=b"", error=error)
    return Source(name=name, body=body)
