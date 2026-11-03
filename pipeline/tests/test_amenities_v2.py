"""V2 input validation and lossless storage, using synthetic source data."""

import hashlib
import json
from pathlib import Path

import pymupdf
import pytest
from pydantic import ValidationError

from clearcare_pipeline.amenities_v2 import ExtractionFile
from clearcare_pipeline.load_amenities import (
    AmenitiesRecord,
    Summary,
    load,
    read_records,
    validate_source_pdf,
)
from tests.database import API, PIPELINE, migrated_database
from tests.test_load_amenities import RECORD


@pytest.fixture
def source_record(tmp_path: Path) -> ExtractionFile:
    with pymupdf.open() as pdf:
        for _ in range(3):
            pdf.new_page()
        content = pdf.tobytes()  # pyright: ignore[reportUnknownMemberType]
    digest = hashlib.sha256(content).hexdigest()
    path = tmp_path / "raw" / "sha256" / digest[:2] / digest
    path.parent.mkdir(parents=True)
    path.write_bytes(content)
    return ExtractionFile.model_validate_json(
        json.dumps(
            {
                "centre_id": "117",
                "inspection_date": "2025-12-05",
                "file_name": "synthetic.pdf",
                "hiqa_url": "https://example.test/synthetic.pdf",
                "sha256": digest,
                "model": "gpt-4o-mini",
                "extractor_version": "amenities-v2",
                "extracted_at": "2026-11-03T02:00:00Z",
                "amenities": {
                    "care_types": [],
                    "room_types": [],
                    "activities": [],
                    "facilities": [
                        {
                            "item": "Garden",
                            "evidence": [
                                {
                                    "quote": "Synthetic garden passage.",
                                    "page_start": 1,
                                    "page_end": 1,
                                },
                                {
                                    "quote": "Synthetic restriction passage.",
                                    "page_start": 2,
                                    "page_end": 3,
                                },
                            ],
                        }
                    ],
                },
            }
        )
    )


def test_versioned_directories_and_list_files(
    tmp_path: Path, source_record: ExtractionFile
) -> None:
    folder = tmp_path / "amenities-v2" / source_record.centre_id
    folder.mkdir(parents=True)
    (folder / f"{source_record.sha256}.json").write_text(
        source_record.model_dump_json(), encoding="utf-8"
    )
    assert read_records(tmp_path / "amenities-v2") == [source_record]
    list_file = tmp_path / "input.json"
    list_file.write_text(
        json.dumps([source_record.model_dump(mode="json")]), encoding="utf-8"
    )
    assert read_records(list_file) == [source_record]


@pytest.mark.parametrize("stamp", [None, "2026-10-26T12:00:00"])
def test_legacy_input_needs_an_aware_extraction_time(stamp: str | None) -> None:
    record = dict(RECORD)
    if stamp is None:
        record.pop("extracted_at")
    else:
        record["extracted_at"] = stamp
    with pytest.raises(ValidationError):
        AmenitiesRecord.model_validate(record)


def test_loader_checks_original_pdf_bounds_and_hash(
    tmp_path: Path, source_record: ExtractionFile
) -> None:
    validate_source_pdf(source_record, tmp_path)
    source_record.amenities.facilities[0].evidence[1].page_end = 4
    with pytest.raises(ValueError, match="exceeds"):
        validate_source_pdf(source_record, tmp_path)
    pdf = (
        tmp_path
        / "raw"
        / "sha256"
        / source_record.sha256[:2]
        / source_record.sha256
    )
    pdf.write_bytes(b"wrong source")
    with pytest.raises(ValueError, match="hash mismatch"):
        validate_source_pdf(source_record, tmp_path)


@pytest.mark.database
def test_v2_round_trip_retains_evidence_and_v1_history(
    tmp_path: Path, source_record: ExtractionFile
) -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.execute(
            "INSERT INTO clearcare.centre (centre_id) VALUES ('117')"
        )
        source = connection.execute(
            "INSERT INTO clearcare.source_file"
            " (source, url, sha256, fetched_at)"
            " VALUES ('inspection-reports', %s, %s, now())"
            " RETURNING source_file_id",
            (source_record.hiqa_url, source_record.sha256),
        ).fetchone()
        assert source is not None
        connection.execute(
            "INSERT INTO clearcare.inspection_report"
            " (source_file_id, centre_id, centre_code, centre_name, address,"
            " inspection_date, fieldwork_id) VALUES"
            " (%s, '117', 'OSV-0000117', 'Synthetic centre', 'Test address',"
            " '2025-12-05', 'TEST-1')",
            (source[0],),
        )
        legacy = AmenitiesRecord.model_validate(
            {**RECORD, "sha256": source_record.sha256}
        )
        assert load(connection, [legacy]) == Summary(1, 0, 0)
        assert load(connection, [source_record], data_dir=tmp_path) == Summary(
            1, 0, 0
        )
        assert load(connection, [source_record], data_dir=tmp_path) == Summary(
            0, 1, 0
        )
        # The same hash must never attach another centre's metadata.
        wrong_centre = source_record.model_copy(update={"centre_id": "999"})
        assert load(connection, [wrong_centre], data_dir=tmp_path) == Summary(
            0, 0, 1
        )
        wrong_date = source_record.model_copy(
            update={"inspection_date": "2025-12-06"}
        )
        assert load(connection, [wrong_date], data_dir=tmp_path) == Summary(
            0, 0, 1
        )
        connection.commit()
        with database.connect(API) as api:
            row = api.execute(
                "SELECT amenities, model, extracted_at, sha256, file_name,"
                " hiqa_url FROM clearcare.centre_amenities_v2"
                " WHERE centre_id = '117'"
            ).fetchone()
            assert row == (
                source_record.amenities.model_dump(),
                source_record.model,
                source_record.extracted_at,
                source_record.sha256,
                source_record.file_name,
                source_record.hiqa_url,
            )
            assert api.execute(
                "SELECT extractor_version FROM clearcare.centre_amenities"
                " WHERE centre_id = '117'"
            ).fetchone() == ("amenities-v0",)
