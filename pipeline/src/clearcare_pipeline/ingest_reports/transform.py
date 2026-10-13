"""Turning a parsed report into the rows the database stores (CCARE-34).

This is the business logic between the parser and the database: deriving the
register's numeric centre ID from the printed Centre ID, reading the report's
dates and times, and splitting a regulation into its number and title. The
parser reads values as the report writes them; this module decides what the
database needs.
"""

import re
from datetime import date, datetime, time
from typing import Final

from clearcare_pipeline.ingest_reports.models import (
    InspectionComplianceItem,
    InspectionInspector,
    InspectionRegulation,
    InspectionReport,
)
from clearcare_pipeline.parser.fields import Record, Value
from clearcare_pipeline.parser.fields import Report as ParsedReport

# The Center ID the report prints, e.g. OSV-0000117. The register names a
# center by the number without the prefix or leading zeros, so 0000117 -> 117.
CENTRE_CODE: Final = re.compile(r"^OSV-(\d+)$")
# "05 December 2025", as the cover prints the inspection date.
INSPECTION_DATE: Final = "%d %B %Y"
# "Friday 5 December 2025", as the inspectors table prints the day.
INSPECTOR_DATE: Final = "%A %d %B %Y"
# "01/09/2026", as the compliance plan prints a date to comply (DD/MM/YYYY).
COMPLIANCE_DATE: Final = "%d/%m/%Y"
# "09:00hrs to 17:20hrs", as the inspectors table prints the times.
TIMES: Final = re.compile(r"(\d{1,2}:\d{2})\s*hrs\s*to\s*(\d{1,2}:\d{2})\s*hrs")


class TransformError(Exception):
    """A parsed report lacks something the database requires."""


def to_inspection_report(
    parsed: ParsedReport, source_file_id: int
) -> InspectionReport:
    """Turns the parser's output into the rows the database stores.

    Raises:
        TransformError: If the Centre ID, centre name, address or Fieldwork
            ID is missing, or the Centre ID is not OSV followed by digits.
    """
    centre_code = _required(parsed, "centre_code")
    match = CENTRE_CODE.match(centre_code)
    if match is None:
        raise TransformError(f"Centre ID is not OSV-nnnnnnn: {centre_code!r}")
    return InspectionReport(
        source_file_id=source_file_id,
        centre_id=str(int(match.group(1))),
        centre_code=centre_code,
        centre_name=_required(parsed, "centre_name"),
        provider_name=_text(parsed.fields.get("provider_name")),
        address=_required(parsed, "address"),
        inspection_type=_text(parsed.fields.get("inspection_type")),
        inspection_date=_date(
            parsed.fields.get("inspection_date"), INSPECTION_DATE
        ),
        fieldwork_id=_required(parsed, "fieldwork_id"),
        residents=_int(parsed.fields.get("residents")),
        inspectors=tuple(
            _inspector(row) for row in parsed.records.get("inspectors", ())
        ),
        regulations=tuple(
            _regulation(row) for row in parsed.records.get("regulations", ())
        ),
        compliance_items=tuple(
            _item(row) for row in parsed.records.get("compliance_items", ())
        ),
    )


def _text(value: Value) -> str | None:
    """Returns a value as trimmed text, or None when it is empty."""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _required(parsed: ParsedReport, key: str) -> str:
    """Returns a required cover value.

    Raises:
        TransformError: If the report does not have it.
    """
    value = _text(parsed.fields.get(key))
    if value is None:
        raise TransformError(f"the report has no {key}")
    return value


def _int(value: Value) -> int | None:
    """Returns the value when the parser read it as a whole number."""
    return value if isinstance(value, int) else None


def _date(value: Value, fmt: str) -> date | None:
    """Parses a date, or None when it is missing or not in that format."""
    text = _text(value)
    if text is None:
        return None
    try:
        return datetime.strptime(text, fmt).date()
    except ValueError:
        return None


def _required_date(value: Value, fmt: str, what: str) -> date:
    """Parses a required date.

    Raises:
        TransformError: If it is missing or not in that format.
    """
    parsed = _date(value, fmt)
    if parsed is None:
        raise TransformError(f"{what} is not a date: {value!r}")
    return parsed


def _field(row: Record, key: str) -> str:
    """Returns a required value from a record.

    Raises:
        TransformError: If the record does not have it.
    """
    value = _text(row.get(key))
    if value is None:
        raise TransformError(f"a record has no {key}")
    return value


def _inspector(row: Record) -> InspectionInspector:
    start, end = _times(row.get("times"))
    return InspectionInspector(
        date=_required_date(
            row.get("date"), INSPECTOR_DATE, "an inspector date"
        ),
        start_time=start,
        end_time=end,
        name=_field(row, "inspector"),
        role=_text(row.get("role")),
    )


def _times(value: Value) -> tuple[time | None, time | None]:
    """Returns the start and end times of "09:00hrs to 17:20hrs"."""
    text = _text(value)
    match = TIMES.search(text) if text is not None else None
    if match is None:
        return None, None
    return _parse_time(match.group(1)), _parse_time(match.group(2))


def _parse_time(text: str) -> time | None:
    """Reads "09:00" as a time, or None when it is not one."""
    try:
        return datetime.strptime(text, "%H:%M").time()
    except ValueError:
        return None


def _regulation(row: Record) -> InspectionRegulation:
    """Splits "Regulation 15: Staffing" into its number and title."""
    value = _field(row, "regulation")
    regulation, _, title = value.partition(": ")
    return InspectionRegulation(
        regulation=regulation.strip(),
        title=title.strip(),
        judgment=_field(row, "judgment"),
    )


def _item(row: Record) -> InspectionComplianceItem:
    return InspectionComplianceItem(
        regulation=_field(row, "regulation"),
        requirement=_field(row, "requirement"),
        judgment=_text(row.get("judgment")),
        risk_rating=_text(row.get("risk_rating")),
        date_to_comply=_date(row.get("date_to_comply"), COMPLIANCE_DATE),
    )
