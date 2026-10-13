"""Parsing, transforming and writing reports, a batch at a time (CCARE-34).

This is the workflow behind the command line entry point: it reads reports
from a source, parses and transforms each one, buffers the rows, and writes
them through a writer a batch at a time.
"""

import hashlib
import logging
import tempfile
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from pathlib import Path

from clearcare_pipeline.ingest_reports.database import Writer
from clearcare_pipeline.ingest_reports.models import InspectionReport
from clearcare_pipeline.ingest_reports.sources import Source
from clearcare_pipeline.ingest_reports.transform import (
    TransformError,
    to_inspection_report,
)
from clearcare_pipeline.parser.fields import Report as ParsedReport
from clearcare_pipeline.parser.fields import extract, load_fields
from clearcare_pipeline.parser.parser import Parser

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Summary:
    """What one ingest run did."""

    parsed: int
    written: int
    skipped: int
    failed: int


def parse_report(body: bytes, mapper: Path, fields: Path) -> ParsedReport:
    """Parses one report's bytes, through a temporary file.

    The parser reads a file, so the bytes are written to a temporary one
    first. That is what lets an object-store body be parsed as it is.
    """
    with tempfile.NamedTemporaryFile(suffix=".pdf") as handle:
        handle.write(body)
        handle.flush()
        path = Path(handle.name)
        sections = Parser(path, mapper).parse()
        return extract(path, sections, load_fields(fields))


def ingest(
    source: Iterator[Source],
    writer: Writer,
    *,
    parse: Callable[[bytes], ParsedReport],
    batch_size: int,
) -> Summary:
    """Parses, transforms and writes every report, a batch at a time.

    The transformed rows are held until the batch is full, then written in one
    transaction and the buffer is cleared. A report whose raw file is not in
    the database is skipped; a report the transform rejects is counted failed.
    """
    buffer: list[InspectionReport] = []
    parsed = written = skipped = failed = 0
    batch_number = 0
    for item in source:
        digest = hashlib.sha256(item.body).hexdigest()
        source_file_id = writer.source_file_id(digest)
        if source_file_id is None:
            logger.warning("%s: no stored file with hash %s", item.name, digest)
            skipped += 1
            continue
        try:
            report = to_inspection_report(parse(item.body), source_file_id)
        except (TransformError, ValueError) as error:
            logger.error("%s: %s", item.name, error)
            failed += 1
            continue
        parsed += 1
        buffer.append(report)
        if len(buffer) >= batch_size:
            batch_number += 1
            print(f"Processed batch number: {batch_number}")
            written += writer.write_batch(buffer)
            buffer.clear()
    if buffer:
        batch_number += 1
        print(f"Processed final batch number: {batch_number}")
        written += writer.write_batch(buffer)
    return Summary(
        parsed=parsed, written=written, skipped=skipped, failed=failed
    )
