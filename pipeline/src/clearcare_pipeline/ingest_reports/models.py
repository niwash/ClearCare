"""The rows a parsed inspection report becomes.

These mirror the tables in db/V2__inspection_reports.sql.
"""

from dataclasses import dataclass
from datetime import date, time

from clearcare_pipeline.parser.text import ReportText


@dataclass(frozen=True)
class InspectionInspector:
    """One inspector named on a report."""

    date: date
    start_time: time | None
    end_time: time | None
    name: str
    role: str | None


@dataclass(frozen=True)
class InspectionRegulation:
    """One regulation considered, from Appendix 1."""

    regulation: str
    title: str
    judgment: str


@dataclass(frozen=True)
class InspectionComplianceItem:
    """One row of the compliance plan."""

    regulation: str
    requirement: str
    judgment: str | None
    risk_rating: str | None
    date_to_comply: date | None


@dataclass(frozen=True)
class InspectionReport:
    """A parsed report, ready to write."""

    source_file_id: int
    centre_id: str
    centre_code: str
    centre_name: str
    provider_name: str | None
    address: str
    inspection_type: str | None
    inspection_date: date | None
    fieldwork_id: str
    residents: int | None
    inspectors: tuple[InspectionInspector, ...]
    regulations: tuple[InspectionRegulation, ...]
    compliance_items: tuple[InspectionComplianceItem, ...]
    text: tuple[ReportText, ...] = ()
