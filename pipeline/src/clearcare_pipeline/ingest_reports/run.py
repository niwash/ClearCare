"""Parsing, transforming and writing reports, a batch at a time (CCARE-34).

This is the workflow behind the command line entry point: it reads reports
from a source, parses and transforms each one, buffers the rows, and writes
them through a writer a batch at a time.
"""

import hashlib
import logging
import tempfile
from collections.abc import Callable, Iterator
from dataclasses import dataclass, replace
from pathlib import Path

import pymupdf

from clearcare_pipeline.ingest_reports.database import Catalogue, Writer
from clearcare_pipeline.ingest_reports.models import InspectionReport
from clearcare_pipeline.ingest_reports.sources import Source
from clearcare_pipeline.ingest_reports.transform import (
    TransformError,
    to_inspection_report,
)
from clearcare_pipeline.parser.fields import Report as ParsedReport
from clearcare_pipeline.parser.fields import extract, load_fields
from clearcare_pipeline.parser.parser import Parser
from clearcare_pipeline.parser.text import extract as extract_text
from clearcare_pipeline.parser.text import validate

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Summary:
    """What one ingest run did."""

    parsed: int
    written: int
    already_loaded: int
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
        parsed = extract(path, sections, load_fields(fields))
        text, uncut = extract_text(sections)
        missing = validate(
            text,
            {
                " ".join(
                    str(row["regulation"]).partition(":")[0].split()
                ): " ".join(str(row["judgment"]).split())
                for row in parsed.records.get("regulations", ())
            },
            uncut,
        )
        return replace(parsed, text=text, missing_responses=missing)


def ingest(
    source: Iterator[Source],
    catalogue: Catalogue,
    writer: Writer,
    *,
    parse: Callable[[bytes], ParsedReport],
    batch_size: int,
) -> Summary:
    """Parses, transforms and writes every report, a batch at a time.

    The transformed rows are held until the batch is full, then written in one
    transaction and the buffer is cleared. A report already loaded from the
    same file is counted and not parsed again. A report whose raw file the
    catalogue does not have is skipped, and so is one whose centre it does not
    have; a report the transform rejects, or one that cannot be read, is
    counted failed.
    """
    buffer: list[InspectionReport] = []
    parsed = written = already_loaded = skipped = failed = 0
    batch_number = 0
    for item in source:
        if item.error is not None:
            logger.error("%s: %s", item.name, item.error)
            failed += 1
            continue
        digest = hashlib.sha256(item.body).hexdigest()
        if catalogue.report_loaded(digest):
            already_loaded += 1
            continue
        source_file_id = catalogue.source_file_id(digest)
        if source_file_id is None:
            logger.warning("%s: no stored file with hash %s", item.name, digest)
            skipped += 1
            continue
        try:
            extracted = parse(item.body)
            for regulation, reason in extracted.missing_responses:
                logger.warning("%s, %s: %s", item.name, regulation, reason)
            report = to_inspection_report(extracted, source_file_id)
        except (TransformError, ValueError, pymupdf.FileDataError) as error:
            logger.error("%s: %s", item.name, error)
            failed += 1
            continue
        if not catalogue.centre_exists(report.centre_id):
            logger.warning(
                "%s: no stored centre %s", item.name, report.centre_id
            )
            skipped += 1
            continue
        parsed += 1
        buffer.append(report)
        if len(buffer) >= batch_size:
            written += writer.write_batch(buffer)
            batch_number += 1
            logger.info("batch %d written", batch_number)
            buffer.clear()
    if buffer:
        written += writer.write_batch(buffer)
        batch_number += 1
        logger.info("final batch %d written", batch_number)
    return Summary(
        parsed=parsed,
        written=written,
        already_loaded=already_loaded,
        skipped=skipped,
        failed=failed,
    )
