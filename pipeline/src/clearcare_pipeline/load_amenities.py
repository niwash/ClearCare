"""Load extracted amenities: python -m clearcare_pipeline.load_amenities.

The input is either a folder of the extractor's output files (one JSON file per
centre, as Research/Data Extraction/extractor.py writes them) or one JSON file
holding a list of such records. A record names the report by the SHA-256 of its
PDF (db/V1's source_file), which is how the extraction and the database agree
on which report was read, and carries the model and extractor version:

    {"sha256": "...", "model": "gpt-4o-mini",
     "extractor_version": "amenities-v1",
     "extracted_at": "2026-10-26T12:00:00+00:00",
     "amenities": {"care_types": [...], ...}}

extracted_at is optional; a record without it is stamped with the load time.
Other keys in a record, such as centre_id or inspection_date, are ignored.
"""

import argparse
import logging
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import psycopg
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError

from clearcare_pipeline.ingest_reports.database import Connection

logger = logging.getLogger(__name__)


class Amenities(BaseModel):
    """The nine fields the extraction returns for one report."""

    model_config = ConfigDict(extra="forbid")

    care_types: list[str] = Field(default_factory=list)
    room_types: list[str] = Field(default_factory=list)
    has_outdoor_space: bool | None = None
    activities: list[str] = Field(default_factory=list)
    has_transport: bool | None = None
    has_chapel_or_religious_services: bool | None = None
    special_units: list[str] = Field(default_factory=list)
    dining_notes: str = ""
    other_notes: str = ""


class AmenitiesRecord(BaseModel):
    """One report's amenities and the extraction that produced them.

    The extractor's files carry more keys than the database needs (centre_id,
    inspection_date, hiqa_url and so on), so unknown keys are ignored here. The
    nine amenities fields themselves are checked strictly.
    """

    model_config = ConfigDict(extra="ignore")

    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    model: str = Field(min_length=1)
    extractor_version: str = Field(min_length=1)
    # When the extractor ran. Older results may not have it.
    extracted_at: datetime | None = None
    amenities: Amenities


# Reads a list file in one step, without wrapping it in another object.
_RECORDS = TypeAdapter(list[AmenitiesRecord])


@dataclass(frozen=True)
class Summary:
    """What a load did."""

    written: int
    already_loaded: int
    unmatched: int


_FIND_REPORT = (
    "SELECT r.id FROM clearcare.inspection_report r"
    " JOIN clearcare.source_file s USING (source_file_id)"
    " WHERE s.sha256 = %s ORDER BY r.id LIMIT 1"
)

_INSERT = (
    "INSERT INTO clearcare.report_amenities (report_id, care_types,"
    " room_types, has_outdoor_space, activities, has_transport,"
    " has_chapel_or_religious_services, special_units, dining_notes,"
    " other_notes, extractor_version, model, extracted_at)"
    " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,"
    # A record without extracted_at gets the load time, as the column default.
    " COALESCE(%s, now()))"
    " ON CONFLICT (report_id, extractor_version) DO NOTHING"
)


def read_records(path: Path) -> list[AmenitiesRecord]:
    """Reads and checks the input: a folder of files, or one list file.

    Raises:
        ValueError: If a file is not a valid record, or a list of them.
    """
    if path.is_dir():
        files = sorted(path.glob("*.json"))
        if not files:
            raise ValueError(f"{path}: no .json files found")
        return [
            record for file in files for record in _read_file(file, single=True)
        ]
    return _read_file(path, single=False)


def _read_file(path: Path, *, single: bool) -> list[AmenitiesRecord]:
    """Reads one file: a single record if single, otherwise a list of them."""
    text = path.read_text(encoding="utf-8")
    try:
        if single:
            return [AmenitiesRecord.model_validate_json(text)]
        return _RECORDS.validate_json(text)
    except ValidationError as error:
        raise ValueError(f"{path}: {error}") from error


def load(connection: Connection, records: Sequence[AmenitiesRecord]) -> Summary:
    """Writes each record once; a loaded report and version is left alone.

    A record whose PDF is not among the stored reports is counted and logged,
    so that a hash mismatch is visible and nothing is attached to the wrong
    report.
    """
    written = already_loaded = unmatched = 0
    with connection.transaction():
        for record in records:
            row = connection.execute(_FIND_REPORT, (record.sha256,)).fetchone()
            if row is None:
                logger.warning("no stored report for %s", record.sha256)
                unmatched += 1
                continue
            amenities = record.amenities
            cursor = connection.execute(
                _INSERT,
                (
                    row[0],
                    amenities.care_types,
                    amenities.room_types,
                    amenities.has_outdoor_space,
                    amenities.activities,
                    amenities.has_transport,
                    amenities.has_chapel_or_religious_services,
                    amenities.special_units,
                    amenities.dining_notes,
                    amenities.other_notes,
                    record.extractor_version,
                    record.model,
                    record.extracted_at,
                ),
            )
            if cursor.rowcount:
                written += 1
            else:
                already_loaded += 1
    return Summary(written, already_loaded, unmatched)


def main(argv: Sequence[str] | None = None) -> int:
    """Loads the file, connecting through libpq settings."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    try:
        records = read_records(args.input)
        with psycopg.connect(autocommit=True) as connection:
            summary = load(connection, records)
    except (psycopg.Error, OSError, ValueError) as error:
        logger.error("%s", error)
        return 1
    logger.info(
        "wrote %d, already loaded %d, unmatched %d",
        summary.written,
        summary.already_loaded,
        summary.unmatched,
    )
    return int(summary.unmatched > 0)


if __name__ == "__main__":
    sys.exit(main())
