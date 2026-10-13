"""The reports to ingest, from a file list or a store prefix."""

import logging
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from pathlib import Path

from clearcare_pipeline.object_store import ObjectStore

PDF_SIGNATURE = b"%PDF"

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Source:
    """One report to parse: a name for the logs, and its bytes."""

    name: str
    body: bytes


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
