"""Tests for reading a thematic report through its own mapping."""

from datetime import date
from pathlib import Path

import pytest

from clearcare_pipeline.ingest_reports.models import ThematicReport
from clearcare_pipeline.ingest_reports.run import parse_thematic_report
from clearcare_pipeline.ingest_reports.transform import (
    TransformError,
    to_thematic_report,
)
from clearcare_pipeline.parser.fields import Report as ParsedReport
from tests.report_fixtures import write_report_pdf, write_thematic_report_pdf

PARSER = Path(__file__).parents[2] / "src/clearcare_pipeline/parser"
SOURCE_FILE_ID = 7


def _parse(path: Path) -> ParsedReport | None:
    return parse_thematic_report(
        path.read_bytes(),
        PARSER / "thematic_mapper.csv",
        PARSER / "thematic_fields.csv",
    )


def _thematic_report(
    tmp_path: Path, overall_judgment: str | None = "Compliant"
) -> ParsedReport:
    path = tmp_path / "thematic.pdf"
    write_thematic_report_pdf(path, overall_judgment=overall_judgment)
    parsed = _parse(path)
    assert parsed is not None
    return parsed


def test_cover_values_and_overall_judgment_are_read(tmp_path: Path) -> None:
    parsed = _thematic_report(tmp_path)

    assert to_thematic_report(parsed, SOURCE_FILE_ID) == ThematicReport(
        source_file_id=SOURCE_FILE_ID,
        centre_id="238",
        centre_code="OSV-0000238",
        inspection_type="Unannounced",
        inspection_date=date(2025, 8, 21),
        fieldwork_id="MON-0047312",
        overall_judgment="Compliant",
    )


def test_a_regulation_report_is_not_a_thematic_report(tmp_path: Path) -> None:
    path = tmp_path / "report.pdf"
    write_report_pdf(path)

    assert _parse(path) is None


def test_overall_judgment_printed_over_two_lines_is_one_value(
    tmp_path: Path,
) -> None:
    parsed = _thematic_report(tmp_path, "Substantially\nCompliant")

    report = to_thematic_report(parsed, SOURCE_FILE_ID)

    assert report.overall_judgment == "Substantially Compliant"


def test_standards_listed_in_the_appendix_are_not_overall_judgments(
    tmp_path: Path,
) -> None:
    # The appendix lists each standard in a row of two cells, as the overall
    # judgment and its description are.
    parsed = _thematic_report(tmp_path)

    judgments = [row["judgment"] for row in parsed.records["overall_judgment"]]

    assert judgments == ["Compliant"]


def test_provider_name_is_not_read(tmp_path: Path) -> None:
    # A provider can be a person, so the name on the cover goes no further.
    parsed = _thematic_report(tmp_path)

    assert "Fern Valley Care Limited" not in repr(parsed)


def test_thematic_report_with_an_empty_overall_judgment_is_rejected(
    tmp_path: Path,
) -> None:
    # The description beside the empty cell must not be read in its place.
    parsed = _thematic_report(tmp_path, overall_judgment=None)

    with pytest.raises(TransformError, match="overall judgment"):
        to_thematic_report(parsed, SOURCE_FILE_ID)
