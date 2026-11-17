"""V2 input validation and lossless storage, using synthetic source data."""

import hashlib
import json
from pathlib import Path
from typing import cast
from unittest.mock import MagicMock

import pymupdf
import pytest

from clearcare_pipeline.amenities_v2 import (
    CATEGORY_ORDER,
    Amenities,
    EvidenceCheck,
    ExtractionFile,
    SelectedItem,
)
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
def test_legacy_timestamp_behaviour_is_unchanged(stamp: str | None) -> None:
    record = dict(RECORD)
    if stamp is None:
        record.pop("extracted_at")
    else:
        record["extracted_at"] = stamp
    parsed = AmenitiesRecord.model_validate(record)
    if stamp is None:
        assert parsed.extracted_at is None
    else:
        assert parsed.extracted_at is not None
        assert parsed.extracted_at.isoformat() == stamp


@pytest.mark.parametrize("stamp", [None, "2026-11-03T02:00:00"])
def test_v2_still_requires_an_aware_timestamp(
    tmp_path: Path, source_record: ExtractionFile, stamp: str | None
) -> None:
    record = source_record.model_dump(mode="json")
    if stamp is None:
        record.pop("extracted_at")
    else:
        record["extracted_at"] = stamp
    path = tmp_path / "invalid-v2.json"
    path.write_text(json.dumps([record]), encoding="utf-8")
    with pytest.raises(ValueError, match=r"invalid-v2\.json"):
        read_records(path)


def test_v2_cannot_fall_back_to_the_legacy_contract(tmp_path: Path) -> None:
    path = tmp_path / "legacy-shape-v2.json"
    path.write_text(
        json.dumps([{**RECORD, "extractor_version": "amenities-v2"}]),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match=r"legacy-shape-v2\.json"):
        read_records(path)


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
    tmp_path: Path,
    source_record: ExtractionFile,
    caplog: pytest.LogCaptureFixture,
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
            {**RECORD, "sha256": source_record.sha256, "extracted_at": None}
        )
        legacy_load_time = connection.execute("SELECT now()").fetchone()
        assert load(connection, [legacy]) == Summary(1, 0, 0)
        assert (
            connection.execute(
                "SELECT extracted_at FROM clearcare.report_amenities"
                " WHERE extractor_version = 'amenities-v0'"
            ).fetchone()
            == legacy_load_time
        )
        # A date mismatch on the first load must still store exact-source data.
        mismatched = source_record.model_copy(
            update={"inspection_date": "2026-12-05"}
        )
        assert load(connection, [mismatched], data_dir=tmp_path) == Summary(
            1, 0, 0
        )
        assert "inspection date mismatch" in caplog.text
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
            0, 1, 0
        )
        connection.commit()
        with database.connect(API) as api:
            stored_date = api.execute(
                "SELECT inspection_date FROM clearcare.centre_amenities_v2"
                " WHERE centre_id = '117'"
            ).fetchone()
            assert stored_date is not None
            assert str(stored_date[0]) == "2025-12-05"
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


def test_ambiguous_source_rolls_back_instead_of_selecting_first(
    source_record: ExtractionFile, tmp_path: Path
) -> None:
    connection = MagicMock()
    connection.execute.return_value.fetchall.return_value = [
        (1, "2025-12-05"),
        (2, "2025-12-05"),
    ]
    with pytest.raises(ValueError, match="Ambiguous stored report"):
        load(connection, [source_record], data_dir=tmp_path)
    assert connection.execute.call_count == 1
    assert (
        connection.transaction.return_value.__exit__.call_args.args[0]
        is ValueError
    )


# Evidence checked against the report text (verify_evidence).

PAGES = [
    "Cover page.\nPage 1 of 5",
    "The centre has a large garden.\nPage 2 of 5",
    "Residents enjoyed bingo.\nPage 3 of 5",
    "Residents enjoyed bingo.\nPage 4 of 5",
    "Residents enjoyed bingo.\nPage 5 of 5",
]
Quote = tuple[str, int, int]


def amenities(**lists: dict[str, list[Quote]]) -> Amenities:
    data: dict[str, list[dict[str, object]]] = {
        field: [] for field in CATEGORY_ORDER
    }
    for field, items in lists.items():
        data[field] = [
            {
                "item": item,
                "evidence": [
                    {"quote": quote, "page_start": start, "page_end": end}
                    for quote, start, end in quotes
                ],
            }
            for item, quotes in items.items()
        ]
    return Amenities.model_validate(data)


def quotes(result: Amenities, field: str) -> list[Quote]:
    entries = cast(list[SelectedItem], getattr(result, field))
    return [
        (evidence.quote, evidence.page_start, evidence.page_end)
        for entry in entries
        for evidence in entry.evidence
    ]


def test_a_quote_on_its_cited_page_is_kept_as_it_is() -> None:
    # The passage is on pages 3, 4 and 5; the cited page 4 wins.
    original = amenities(
        activities={"Bingo": [("Residents enjoyed bingo.", 4, 4)]}
    )
    verified, check = original.verify_evidence(PAGES)
    assert verified == original
    assert check == EvidenceCheck(items_kept=1)


def test_a_quote_on_another_page_gets_the_page_it_is_on() -> None:
    # Pages 4 and 5 do not have it, so the whole report is searched.
    verified, check = amenities(
        facilities={"Garden": [("The centre has a large garden.", 5, 5)]}
    ).verify_evidence(PAGES)
    assert quotes(verified, "facilities") == [
        ("The centre has a large garden.", 2, 2)
    ]
    assert check == EvidenceCheck(items_kept=1, evidence_corrected=1)


def test_the_pages_next_to_the_cited_one_are_searched_first() -> None:
    # The passage is on pages 1 and 5. Page 5 is next to the cited page 4,
    # so it wins over page 1, which a search of the whole report finds first.
    pages = [
        "Bingo daily.",
        "Other text.",
        "Other text.",
        "Other.",
        "Bingo daily.",
    ]
    verified, _ = amenities(
        activities={"Bingo": [("Bingo daily.", 4, 4)]}
    ).verify_evidence(pages)
    assert quotes(verified, "activities") == [("Bingo daily.", 5, 5)]


def test_a_quote_across_a_page_break_is_found_despite_the_footer() -> None:
    pages = [
        "Residents had access to radio and\nPage 1 of 2",
        "newspapers every day.\nPage 2 of 2",
    ]
    quote = "Residents had access to radio and newspapers every day."
    verified, check = amenities(
        activities={"Radio": [(quote, 1, 1)]}
    ).verify_evidence(pages)
    assert quotes(verified, "activities") == [(quote, 1, 2)]
    assert check == EvidenceCheck(items_kept=1, evidence_corrected=1)


@pytest.mark.parametrize(
    ("page", "quote", "found"),
    [
        (
            "Twenty bedrooms had an en-\nsuite shower.",
            "had an en-suite shower",
            True,
        ),
        ("All rooms are en suite.", "All rooms are en-suite.", True),
        ("All rooms are en-suite.", "All rooms are en suite.", True),
        ("A large gar-\nden.", "A large garden.", True),
        ("A large gar\u00ad\nden.", "A large garden.", True),
        (
            "The residents\u2019 en-suite rooms.",
            "The residents' en-suite rooms.",
            True,
        ),
        ("A \u201cfamily\u201d en-suite.", 'A "family" en-suite.', True),
        ("En-suite \u2013 all rooms.", "En-suite - all rooms.", True),
        ("En-suite with \ufb02owers.", "En-suite with flowers.", True),
        ("All rooms are EN-SUITE,", "all rooms are en-suite.", True),
        ("Bingo, music and art.", "Bingo", True),
        ("It has 6 twin rooms and 1 single.", "6 twin rooms, and 1", True),
        (
            "Rang the bell. tResidents had access to newspapers.",
            "Residents had access to newspapers",
            True,
        ),
        ("There are 12 single rooms.", "2 single rooms", False),
        ("Room 12 has a sink.", "Room 1", False),
    ],
    ids=[
        "line-end hyphen",
        "hyphen for a space",
        "space for a hyphen",
        "split word",
        "soft hyphen",
        "apostrophe",
        "quotes",
        "dash",
        "ligature",
        "ends",
        "short quote",
        "comma added",
        "letter glued on",
        "inside a number",
        "number cut short",
    ],
)
def test_a_quote_matches_whatever_its_punctuation_but_not_inside_a_number(
    page: str, quote: str, found: bool
) -> None:
    verified, check = amenities(
        room_types={"En-suite facilities": [(quote, 1, 1)]}
    ).verify_evidence([page])
    assert quotes(verified, "room_types") == ([(quote, 1, 1)] if found else [])
    assert check.evidence_dropped == (0 if found else 1)


def test_a_quote_found_nowhere_is_dropped_and_so_is_an_item_left_bare() -> None:
    verified, check = amenities(
        facilities={
            "Garden": [
                ("The centre has a large garden.", 2, 2),
                ("A rooftop garden.", 2, 2),
                ("...", 2, 2),
            ]
        },
        activities={"Bingo": [("Bingo on Fridays.", 3, 3)]},
    ).verify_evidence(PAGES)
    assert quotes(verified, "facilities") == [
        ("The centre has a large garden.", 2, 2)
    ]
    assert verified.activities == []
    assert check == EvidenceCheck(
        items_kept=1,
        items_dropped=1,
        evidence_dropped=3,
        dropped=(
            ("activities", "Bingo", "Bingo on Fridays."),
            ("facilities", "Garden", "A rooftop garden."),
            ("facilities", "Garden", "..."),
        ),
    )
