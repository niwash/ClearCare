"""Tests for the transform step: parsed report to database rows."""

from datetime import date, time

import pytest

from clearcare_pipeline.ingest_reports.models import (
    InspectionComplianceItem,
    InspectionInspector,
    InspectionRegulation,
)
from clearcare_pipeline.ingest_reports.transform import (
    TransformError,
    to_inspection_report,
)
from clearcare_pipeline.parser.fields import Record, Value
from clearcare_pipeline.parser.fields import Report as ParsedReport

SOURCE_FILE_ID = 7


def _fields(**overrides: Value) -> dict[str, Value]:
    fields: dict[str, Value] = {
        "centre_name": "Fern Valley Nursing Home",
        "provider_name": "Fern Valley Care Limited",
        "address": "Sample Street, Carlow",
        "inspection_type": "Unannounced",
        "inspection_date": "05 December 2025",
        "centre_code": "OSV-0000117",
        "fieldwork_id": "MON-0048985",
        "residents": 48,
    }
    fields.update(overrides)
    return fields


def _parsed(
    fields: dict[str, Value] | None = None,
    records: dict[str, list[Record]] | None = None,
) -> ParsedReport:
    return ParsedReport(fields=fields or _fields(), records=records or {})


def test_centre_id_is_derived() -> None:
    report = to_inspection_report(_parsed(), SOURCE_FILE_ID)

    assert report.source_file_id == SOURCE_FILE_ID
    assert report.centre_id == "117"
    assert report.centre_code == "OSV-0000117"


def test_inspection_date_is_parsed() -> None:
    report = to_inspection_report(_parsed(), SOURCE_FILE_ID)

    assert report.inspection_date == date(2025, 12, 5)


def test_unparsed_date_is_none() -> None:
    report = to_inspection_report(
        _parsed(_fields(inspection_date="soon")), SOURCE_FILE_ID
    )

    assert report.inspection_date is None


def test_missing_fieldwork_id_is_rejected() -> None:
    with pytest.raises(TransformError, match="fieldwork_id"):
        to_inspection_report(
            _parsed(_fields(fieldwork_id=None)), SOURCE_FILE_ID
        )


def test_non_osv_centre_code_is_rejected() -> None:
    with pytest.raises(TransformError, match="Centre ID"):
        to_inspection_report(
            _parsed(_fields(centre_code="117")), SOURCE_FILE_ID
        )


def test_inspector_is_read() -> None:
    records: dict[str, list[Record]] = {
        "inspectors": [
            {
                "date": "Friday 5 December 2025",
                "times": "09:00hrs to 17:20hrs",
                "inspector": "A. Inspector",
                "role": "Lead",
            }
        ]
    }

    report = to_inspection_report(_parsed(records=records), SOURCE_FILE_ID)

    assert report.inspectors == (
        InspectionInspector(
            date=date(2025, 12, 5),
            start_time=time(9, 0),
            end_time=time(17, 20),
            name="A. Inspector",
            role="Lead",
        ),
    )


def test_unparsed_times_are_none() -> None:
    records: dict[str, list[Record]] = {
        "inspectors": [
            {
                "date": "Friday 5 December 2025",
                "times": "all day",
                "inspector": "A. Inspector",
            }
        ]
    }

    report = to_inspection_report(_parsed(records=records), SOURCE_FILE_ID)

    assert report.inspectors[0].start_time is None
    assert report.inspectors[0].end_time is None


def test_regulation_is_split() -> None:
    records: dict[str, list[Record]] = {
        "regulations": [
            {
                "dimension": "Capacity and capability",
                "regulation": "Regulation 15: Staffing",
                "judgment": "Compliant",
            }
        ]
    }

    report = to_inspection_report(_parsed(records=records), SOURCE_FILE_ID)

    assert report.regulations == (
        InspectionRegulation(
            regulation="Regulation 15", title="Staffing", judgment="Compliant"
        ),
    )


def test_compliance_item_is_read() -> None:
    records: dict[str, list[Record]] = {
        "compliance_items": [
            {
                "regulation": "Regulation 16(1)(a)",
                "requirement": "Staff receive appropriate training.",
                "judgment": "Not Compliant",
                "risk_rating": "Orange",
                "date_to_comply": "01/09/2026",
            }
        ]
    }

    report = to_inspection_report(_parsed(records=records), SOURCE_FILE_ID)

    assert report.compliance_items == (
        InspectionComplianceItem(
            regulation="Regulation 16(1)(a)",
            requirement="Staff receive appropriate training.",
            judgment="Not Compliant",
            risk_rating="Orange",
            date_to_comply=date(2026, 9, 1),
        ),
    )
