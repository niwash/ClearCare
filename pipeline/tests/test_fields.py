from pathlib import Path

import pytest

from clearcare_pipeline.parser.fields import Field, Report, extract, load_fields
from clearcare_pipeline.parser.parser import Parser, TextBlock
from tests.report_fixtures import write_report_pdf

PARSER = Path(__file__).parents[1] / "src" / "clearcare_pipeline" / "parser"
MAPPING = PARSER / "mapper.csv"
FIELDS = PARSER / "fields.csv"
SAMPLE = PARSER / "sample_hiqa_with_highlights.pdf"
HEADER = "kind,group,key,location,source,match,index,transform\n"

EXPECTED_FIELDS = {
    "centre_name": "Fern Valley Nursing Home",
    "provider_name": "Fern Valley Care Limited",
    "address": "Sample Street, Carlow",
    "inspection_type": "Unannounced",
    "inspection_date": "13 May 2026",
    "centre_code": "OSV-0000238",
    "fieldwork_id": "MON-0050709",
    "residents": 48,
    "compliance_date": "13/05/2026",
}
EXPECTED_INSPECTORS = [
    {
        "date": "Wednesday 13 May 2026",
        "times": "08:50hrs to 18:20hrs",
        "inspector": "A. Inspector",
        "role": "Lead",
    },
    {
        "date": "Wednesday 13 May 2026",
        "times": "08:50hrs to 18:20hrs",
        "inspector": "B. Inspector",
        "role": "Support",
    },
]
# The dimension is carried from the row above each regulation. The header row
# is not a record, and a judgment is not mistaken for a dimension.
EXPECTED_REGULATIONS = [
    {
        "dimension": "Capacity and capability",
        "regulation": "Regulation 15: Staffing",
        "judgment": "Compliant",
    },
    {
        "dimension": "Capacity and capability",
        "regulation": "Regulation 16: Training and staff development",
        "judgment": "Not compliant",
    },
    {
        "dimension": "Quality and safety",
        "regulation": "Regulation 17: Premises",
        "judgment": "Not compliant",
    },
]
# The risk rating is written into two columns; it is read once.
EXPECTED_COMPLIANCE = [
    {
        "regulation": "Regulation 16(1)(a)",
        "requirement": "Staff receive appropriate training.",
        "judgment": "Not Compliant",
        "risk_rating": "Orange",
        "date_to_comply": "01/09/2026",
    },
    {
        "regulation": "Regulation 17(1)",
        "requirement": "The premises suit the residents' needs.",
        "judgment": "Substantially Compliant",
        "risk_rating": "Yellow",
        "date_to_comply": "01/09/2026",
    },
]


def _mapping(tmp_path: Path, *rows: str) -> Path:
    path = tmp_path / "fields.csv"
    path.write_text(HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    return path


def _sections(tmp_path: Path) -> tuple[Path, dict[str, list[TextBlock]]]:
    path = tmp_path / "report.pdf"
    write_report_pdf(path)
    return path, Parser(path, MAPPING).parse()


@pytest.fixture(scope="module")
def report(tmp_path_factory: pytest.TempPathFactory) -> Report:
    path = tmp_path_factory.mktemp("report") / "report.pdf"
    write_report_pdf(path)
    sections = Parser(path, MAPPING).parse()
    return extract(path, sections, load_fields(FIELDS))


def test_load_fields_reads_every_row() -> None:
    fields = load_fields(FIELDS)

    assert fields[0].key == "centre_name"
    assert fields[0].source == "table_cell"
    assert {field.group for field in fields if field.kind == "record"} == {
        "inspectors",
        "regulations",
        "compliance_items",
    }


def test_values_are_read_from_the_report(report: Report) -> None:
    assert report.fields == EXPECTED_FIELDS


def test_records_are_read_from_the_report(report: Report) -> None:
    assert report.records["inspectors"] == EXPECTED_INSPECTORS
    assert report.records["regulations"] == EXPECTED_REGULATIONS
    assert report.records["compliance_items"] == EXPECTED_COMPLIANCE


def test_a_value_the_report_does_not_have_is_none(tmp_path: Path) -> None:
    path, sections = _sections(tmp_path)
    fields = (
        Field(
            "field",
            "",
            "missing",
            "issuer",
            "label",
            "Nonesuch:",
            None,
            "strip",
        ),
    )

    assert extract(path, sections, fields).fields["missing"] is None


def test_a_value_is_read_from_given_pages(tmp_path: Path) -> None:
    path, sections = _sections(tmp_path)
    fields = (
        Field(
            "field",
            "",
            "centre_code",
            "pages:1",
            "regex",
            "OSV-[0-9]+",
            None,
            "strip",
        ),
    )

    assert (
        extract(path, sections, fields).fields["centre_code"] == "OSV-0000238"
    )


def test_an_unknown_location_is_rejected(tmp_path: Path) -> None:
    path, sections = _sections(tmp_path)
    fields = (Field("field", "", "x", "nowhere", "label", "a", None, "none"),)

    with pytest.raises(ValueError, match="unknown location: nowhere"):
        extract(path, sections, fields)


def test_pages_outside_the_report_are_rejected(tmp_path: Path) -> None:
    path, sections = _sections(tmp_path)
    fields = (Field("field", "", "x", "pages:99", "label", "a", None, "none"),)

    with pytest.raises(ValueError, match="pages outside the report: 99"):
        extract(path, sections, fields)


def test_a_mapping_with_a_wrong_header_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "fields.csv"
    path.write_text("a,b\n", encoding="utf-8")

    with pytest.raises(ValueError, match="line 1"):
        load_fields(path)


def test_a_mapping_with_no_rows_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "fields.csv"
    path.write_text(HEADER, encoding="utf-8")

    with pytest.raises(ValueError, match="no fields in mapping"):
        load_fields(path)


def test_a_short_row_is_rejected(tmp_path: Path) -> None:
    path = _mapping(tmp_path, "field,centre_name")

    with pytest.raises(ValueError, match="expected 8 columns"):
        load_fields(path)


def test_an_unknown_source_is_rejected(tmp_path: Path) -> None:
    path = _mapping(tmp_path, "field,,centre_name,issuer,magic,Name:,,")

    with pytest.raises(ValueError, match="source must be one of"):
        load_fields(path)


def test_an_unknown_transform_is_rejected(tmp_path: Path) -> None:
    path = _mapping(tmp_path, "field,,centre_name,issuer,label,Name:,,wobble")

    with pytest.raises(ValueError, match="unknown transform: wobble"):
        load_fields(path)


def test_a_field_with_a_group_is_rejected(tmp_path: Path) -> None:
    path = _mapping(tmp_path, "field,group,centre_name,issuer,label,Name:,,")

    with pytest.raises(ValueError, match="must not have a group"):
        load_fields(path)


def test_a_record_without_a_group_is_rejected(tmp_path: Path) -> None:
    path = _mapping(tmp_path, "record,,date,issuer,table_row,,0,strip")

    with pytest.raises(ValueError, match="needs a group"):
        load_fields(path)


def test_an_index_that_is_not_a_number_is_rejected(tmp_path: Path) -> None:
    path = _mapping(tmp_path, "record,g,date,issuer,table_row,,x,strip")

    with pytest.raises(ValueError, match="index is not a number: x"):
        load_fields(path)


def test_a_group_reading_two_locations_is_rejected(tmp_path: Path) -> None:
    path = _mapping(
        tmp_path,
        "record,inspectors,date,issuer,table_row,^D,0,strip",
        "record,inspectors,role,about,table_row,,1,strip",
    )

    with pytest.raises(ValueError, match="more than one location"):
        load_fields(path)


def test_a_group_with_two_markers_is_rejected(tmp_path: Path) -> None:
    path = _mapping(
        tmp_path,
        "record,regulations,dimension,appendix_1,table_row,,,collapse_ws",
        "record,regulations,other,appendix_1,table_row,,,strip",
    )

    with pytest.raises(ValueError, match="more than one marker value"):
        load_fields(path)


def test_a_group_with_no_table_column_is_rejected(tmp_path: Path) -> None:
    path = _mapping(
        tmp_path, "record,regulations,dimension,appendix_1,table_row,,,strip"
    )

    with pytest.raises(ValueError, match="reads no table column"):
        load_fields(path)


@pytest.mark.skipif(
    not SAMPLE.is_file(), reason="the highlighted sample is not committed"
)
def test_the_highlighted_sample_is_read() -> None:
    sections = Parser(SAMPLE, MAPPING).parse()

    report = extract(SAMPLE, sections, load_fields(FIELDS))

    assert report.fields["centre_name"] == (
        "Hillview Convalescence & Nursing Home"
    )
    assert report.fields["centre_code"] == "OSV-0000238"
    assert report.fields["residents"] == 48
    assert report.fields["compliance_date"] == "13/05/2026"
    assert len(report.records["inspectors"]) == 2
    assert report.records["inspectors"][0]["role"] == "Lead"
    assert len(report.records["regulations"]) == 12
    assert len(report.records["compliance_items"]) == 18
