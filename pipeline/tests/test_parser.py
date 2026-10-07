"""Tests for the section-aware report parser."""

import json
from pathlib import Path

import pytest

from clearcare_pipeline.parser.parser import Parser, TextBlock, load_mapping

FIXTURES = Path(__file__).parent / "fixtures"
PDF = FIXTURES / "test_parser.pdf"
MAPPING = (
    Path(__file__).parents[1]
    / "src"
    / "clearcare_pipeline"
    / "parser"
    / "mapper.csv"
)


def _text(sections: dict[str, list[TextBlock]], key: str) -> str:
    return "\n".join(block.text for block in sections[key])


def test_appendix_table_stays_in_appendix_1() -> None:
    sections = Parser(PDF, MAPPING).parse()

    appendix = _text(sections, "appendix_1")

    assert "Regulation 15: Staffing" in appendix
    assert "Compliant" in appendix


def test_sections_keep_the_page_they_came_from() -> None:
    sections = Parser(PDF, MAPPING).parse()

    first = sections["issuer"][0]

    assert first.page == 1
    assert first.text.startswith("Report of an inspection")


def test_load_mapping_reads_every_row() -> None:
    sections = load_mapping(MAPPING)

    assert sections[0].pattern == "Report of an inspection"
    assert sections[0].key == "issuer"
    assert {section.key for section in sections} >= {"appendix_1", "section_2"}


def test_load_mapping_rejects_a_short_row(tmp_path: Path) -> None:
    mapping = tmp_path / "mapper.csv"
    mapping.write_text("Pattern,Internal Mapping\nOnly one column\n")

    with pytest.raises(ValueError, match="expected two columns"):
        load_mapping(mapping)


def test_a_mapping_without_sections_is_rejected(tmp_path: Path) -> None:
    mapping = tmp_path / "mapper.csv"
    mapping.write_text("Pattern,Internal Mapping\n")

    with pytest.raises(ValueError, match="no sections"):
        Parser(PDF, mapping)


def test_main_writes_the_sections_to_json(tmp_path: Path) -> None:
    from clearcare_pipeline.parser.parser import main

    output = tmp_path / "out.json"

    exit_code = main([str(PDF), str(MAPPING), "-o", str(output)])

    assert exit_code == 0
    parsed = json.loads(output.read_text(encoding="utf-8"))
    assert parsed["appendix_1"]
    assert parsed["appendix_1"][0]["page"] == 17


def test_main_reports_a_missing_pdf(tmp_path: Path) -> None:
    from clearcare_pipeline.parser.parser import main

    exit_code = main([str(tmp_path / "missing.pdf"), str(MAPPING)])

    assert exit_code == 1
