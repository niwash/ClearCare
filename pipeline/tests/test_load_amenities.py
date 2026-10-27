"""Tests for loading extracted amenities. The database tests need Docker."""

import json
from pathlib import Path

import pytest

from clearcare_pipeline.load_amenities import (
    AmenitiesRecord,
    Summary,
    load,
    main,
    read_records,
)
from tests.database import API, PIPELINE, migrated_database

SHA = "ab" * 32
OTHER_SHA = "cd" * 32

AMENITIES: dict[str, object] = {
    "care_types": ["long-term residential", "respite care"],
    "room_types": ["single room"],
    "has_outdoor_space": True,
    "activities": [],
    "has_transport": None,
    "has_chapel_or_religious_services": None,
    "special_units": [],
    "dining_notes": "",
    "other_notes": "Views over the harbour.",
}
RECORD: dict[str, object] = {
    "sha256": SHA,
    "model": "gpt-4o-mini",
    "extractor_version": "amenities-v0",
    "amenities": AMENITIES,
}


def _write(path: Path, records: list[dict[str, object]]) -> Path:
    path.write_text(json.dumps(records), encoding="utf-8")
    return path


def test_a_valid_file_is_read(tmp_path: Path) -> None:
    records = read_records(_write(tmp_path / "in.json", [RECORD]))

    assert len(records) == 1
    assert records[0].amenities.care_types == [
        "long-term residential",
        "respite care",
    ]
    assert records[0].amenities.has_outdoor_space is True
    assert records[0].amenities.has_transport is None


def test_a_folder_of_extractor_files_is_read(tmp_path: Path) -> None:
    # The extractor writes one file per centre, with keys the loader ignores.
    for centre in ("1", "2"):
        (tmp_path / f"{centre}.json").write_text(
            json.dumps(
                {**RECORD, "centre_id": centre, "hiqa_url": "https://x"}
            ),
            encoding="utf-8",
        )

    records = read_records(tmp_path)

    assert len(records) == 2
    assert records[0].extractor_version == "amenities-v0"


def test_an_empty_folder_is_refused(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match=r"no \.json files"):
        read_records(tmp_path)


@pytest.mark.parametrize(
    "change",
    [
        {"sha256": "not-a-hash"},
        {"model": ""},
        {"amenities": {"care_types": "dementia care"}},
        {"amenities": {"gender": "female"}},
    ],
)
def test_an_invalid_record_is_refused(
    tmp_path: Path, change: dict[str, object]
) -> None:
    path = _write(tmp_path / "in.json", [{**RECORD, **change}])

    with pytest.raises(ValueError, match=r"in\.json"):
        read_records(path)


def test_main_reports_an_unreadable_file(tmp_path: Path) -> None:
    assert main(["--input", str(tmp_path / "missing.json")]) == 1


@pytest.mark.database
def test_amenities_load_once_and_the_api_sees_the_newest() -> None:
    first = AmenitiesRecord.model_validate(RECORD)
    unmatched = AmenitiesRecord.model_validate({**RECORD, "sha256": OTHER_SHA})
    newer = AmenitiesRecord.model_validate(
        {
            **RECORD,
            "extractor_version": "amenities-v1",
            "amenities": {**AMENITIES, "care_types": ["dementia care"]},
        }
    )
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.execute(
            "INSERT INTO clearcare.centre (centre_id) VALUES ('117')"
        )
        stored = connection.execute(
            "INSERT INTO clearcare.source_file"
            " (source, url, sha256, fetched_at)"
            " VALUES ('inspection-reports', 'https://example.test/r.pdf', %s,"
            " now()) RETURNING source_file_id",
            (SHA,),
        ).fetchone()
        assert stored is not None
        connection.execute(
            "INSERT INTO clearcare.inspection_report (source_file_id,"
            " centre_id, centre_code, centre_name, address, inspection_date,"
            " fieldwork_id) VALUES (%s, '117', 'OSV-0000117', 'Fern Valley',"
            " 'Sample Street', '2025-12-05', 'MON-1')",
            (stored[0],),
        )

        assert load(connection, [first, unmatched]) == Summary(1, 0, 1)
        # The same extraction again adds nothing.
        assert load(connection, [first]) == Summary(0, 1, 0)
        assert load(connection, [newer]) == Summary(1, 0, 0)
        connection.commit()

        with database.connect(API) as api:
            rows = api.execute(
                "SELECT centre_id, care_types, has_outdoor_space,"
                " has_transport, extractor_version, model"
                " FROM clearcare.centre_amenities"
            ).fetchall()
        assert rows == [
            (
                "117",
                ["dementia care"],
                True,
                None,
                "amenities-v1",
                "gpt-4o-mini",
            )
        ]
