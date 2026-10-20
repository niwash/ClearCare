from pathlib import Path

import pytest

from clearcare_pipeline.parser.fields import (
    Field,
    Record,
    Report,
    extract,
    load_fields,
)
from clearcare_pipeline.parser.parser import Parser, TextBlock
from tests.report_fixtures import write_report_pdf

PARSER = Path(__file__).parents[1] / "src" / "clearcare_pipeline" / "parser"
MAPPING = PARSER / "mapper.csv"
FIELDS = PARSER / "fields.csv"
SAMPLE = PARSER / "sample_hiqa_with_highlights.pdf"
PRICE_PDF = PARSER / "max_contract_price_private.pdf"
PRICE_MAPPER = PARSER / "contract_price_mapper.csv"
PRICE_FIELDS = PARSER / "contract_price_private_fields.csv"
PUBLIC_PRICE_PDF = PARSER / "max_contract_price_public.pdf"
PUBLIC_PRICE_FIELDS = PARSER / "contract_price_public_fields.csv"
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
# The risk rating is written into two columns; it is read once. The last row
# runs over a page break, so its requirement and judgment are joined from the
# row the next page starts with.
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
    {
        "regulation": "Regulation 18(1)",
        "requirement": (
            "The provider shall ensure that the premises are kept clean."
        ),
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


def test_a_comment_in_a_mapping_is_skipped(tmp_path: Path) -> None:
    path = _mapping(
        tmp_path,
        "# a decision this mapping takes",
        "field,,centre_name,issuer,label,Name of designated centre:,,",
    )

    fields = load_fields(path)

    assert [field.key for field in fields] == ["centre_name"]


def test_values_are_read_from_the_report(report: Report) -> None:
    assert report.fields == EXPECTED_FIELDS


def test_records_are_read_from_the_report(report: Report) -> None:
    assert report.records["inspectors"] == EXPECTED_INSPECTORS
    assert report.records["regulations"] == EXPECTED_REGULATIONS
    assert report.records["compliance_items"] == EXPECTED_COMPLIANCE


def test_a_row_that_runs_over_a_page_break_is_joined(report: Report) -> None:
    # The row is printed again at the top of the next page, with nothing in
    # the column that starts a record: one record, joined, and not two.
    records = report.records["compliance_items"]

    assert len(records) == len(EXPECTED_COMPLIANCE)
    assert records[-1]["requirement"] == (
        "The provider shall ensure that the premises are kept clean."
    )
    assert records[-1]["judgment"] == "Substantially Compliant"


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


def test_is_column_index_required(tmp_path: Path) -> None:
    path = _mapping(tmp_path, "record,g,county,issuer,table_column,,,strip")

    with pytest.raises(ValueError, match="table_column needs a column index"):
        load_fields(path)


def test_is_label_record_only(tmp_path: Path) -> None:
    path = _mapping(tmp_path, "field,,county,issuer,table_label,,0,strip")

    with pytest.raises(ValueError, match="table_label is only for a record"):
        load_fields(path)


def test_is_one_source_per_group(
    tmp_path: Path,
) -> None:
    path = _mapping(
        tmp_path,
        "record,g,name,issuer,table_column,,0,strip",
        "record,g,role,issuer,table_row,,1,strip",
    )

    with pytest.raises(ValueError, match="mixes table_row and table_column"):
        load_fields(path)


def test_a_constant_needs_a_value(tmp_path: Path) -> None:
    path = _mapping(tmp_path, "field,,kind,issuer,constant,,,strip")

    with pytest.raises(ValueError, match="constant needs its value in match"):
        load_fields(path)


def test_a_constant_is_a_field(tmp_path: Path) -> None:
    path = _mapping(tmp_path, "record,g,kind,issuer,constant,public,,")

    with pytest.raises(ValueError, match="constant is only for a field"):
        load_fields(path)


@pytest.fixture(scope="module")
def price_report() -> Report:
    sections = Parser(PRICE_PDF, PRICE_MAPPER).parse()
    return extract(PRICE_PDF, sections, load_fields(PRICE_FIELDS))


@pytest.fixture(scope="module")
def price_records(price_report: Report) -> list[Record]:
    return price_report.records["contract_prices"]


@pytest.mark.skipif(
    not PRICE_PDF.is_file(),
    reason="the max contract price list is not committed",
)
class TestMaxContractPrice:
    """The contract price list is one table grouped by county."""

    def test_is_every_centre_read(self, price_records: list[Record]) -> None:
        assert len(price_records) == 411

    def test_is_first_centre_read(self, price_records: list[Record]) -> None:
        assert price_records[0] == {
            "county": "Co. Carlow",
            "centre_name": "Beechwood Nursing Home",
            "centre_id": "199",
            "address_line_1": "Rathvindon",
            "address_line_2": "Leighlinbridge",
            "address_line_3": "Co. Carlow",
            "telephone": "059 9722366",
            "contract_price": "€1,220",
        }

    def test_is_date_modified_read(self, price_report: Report) -> None:
        # The list prints "Date Modified: 4/9/2026" beside its title.
        assert price_report.fields["date_modified"] == "4/9/2026"

    def test_is_private_home_type_read(self, price_report: Report) -> None:
        # The list is the private and voluntary one, so the home type is a
        # value of the list rather than of each record.
        assert price_report.fields["home_type"] == "private"

    def test_is_header_skipped(self, price_records: list[Record]) -> None:
        assert all(
            record["centre_name"] != "Nursing Home Name"
            for record in price_records
        )

    def test_is_blank_cell_aligned(self, price_records: list[Record]) -> None:
        house = next(
            record
            for record in price_records
            if record["centre_name"] == "St. John's House"
        )

        assert house["address_line_2"] == ""
        assert house["address_line_3"] == "Dublin 4"
        assert house["telephone"] == "01 2692213"
        assert house["contract_price"] == "€1,388"

    def test_is_county_carried(self, price_records: list[Record]) -> None:
        # Cork runs over a page break; every row still carries the county
        # heading its block.
        cork = [
            record for record in price_records if record["county"] == "Co. Cork"
        ]

        assert len(cork) > 0
        assert all(record["county"] == "Co. Cork" for record in cork)


@pytest.fixture(scope="module")
def public_price_report() -> Report:
    sections = Parser(PUBLIC_PRICE_PDF, PRICE_MAPPER).parse()
    return extract(PUBLIC_PRICE_PDF, sections, load_fields(PUBLIC_PRICE_FIELDS))


@pytest.fixture(scope="module")
def public_price_records(public_price_report: Report) -> list[Record]:
    return public_price_report.records["contract_prices"]


@pytest.mark.skipif(
    not PUBLIC_PRICE_PDF.is_file(),
    reason="the public contract price list is not committed",
)
class TestPublicContractPrice:
    """The public list prints one row per centre, with no row lines."""

    def test_is_every_centre_read(
        self, public_price_records: list[Record]
    ) -> None:
        assert len(public_price_records) == 115

    def test_is_first_centre_read(
        self, public_price_records: list[Record]
    ) -> None:
        assert public_price_records[0] == {
            "county": "Carlow",
            "centre_id": "549",
            "centre_name": "Sacred Heart Hospital",
            "address_line_1": "Old Dublin Road",
            "address_line_2": "Carlow",
            "address_line_3": "Co. Carlow",
            "postcode": "R93 V825",
            "telephone": "059 913 36470",
            "contract_price": "1,908",
        }

    def test_is_effective_date_read(self, public_price_report: Report) -> None:
        # The list prints "* Effective from 1st September 2026" on page 1.
        assert (
            public_price_report.fields["effective_date"] == "1st September 2026"
        )

    def test_is_public_home_type_read(
        self, public_price_report: Report
    ) -> None:
        assert public_price_report.fields["home_type"] == "public"

    def test_is_header_skipped(
        self, public_price_records: list[Record]
    ) -> None:
        assert all(
            record["centre_name"] != "Name of Public Centre"
            for record in public_price_records
        )

    def test_is_blank_cell_aligned(
        self, public_price_records: list[Record]
    ) -> None:
        # The list prints nothing for this centre's second address line, so
        # the postcode has to be read from its own column, not the next free
        # cell.
        john = next(
            record
            for record in public_price_records
            if record["centre_id"] == "660"
        )

        assert john["address_line_2"] == ""
        assert john["postcode"] == "F91 H224"

    def test_is_county_carried(
        self, public_price_records: list[Record]
    ) -> None:
        # Cork runs over a page break; every row still carries the heading
        # its block was printed under.
        cork = [
            record
            for record in public_price_records
            if record["county"] == "Cork"
        ]

        assert len(cork) == 20
        assert all(record["county"] == "Cork" for record in cork)

    def test_is_county_left_raw(
        self, public_price_records: list[Record]
    ) -> None:
        # The list heads its blocks "Carlow", not "Co. Carlow", and the
        # prefix is put on in the transformation rather than here.
        assert public_price_records[0]["county"] == "Carlow"
