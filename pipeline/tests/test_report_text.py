"""Report text boundaries, using the committed report fixture."""

from pathlib import Path

from clearcare_pipeline.parser.parser import Parser, TextBlock
from clearcare_pipeline.parser.text import extract, validate

PARSER = Path(__file__).parents[1] / "src" / "clearcare_pipeline" / "parser"
PDF = Path(__file__).parent / "fixtures" / "test_parser.pdf"


def test_narrative_keeps_pages_across_a_wrapped_heading_and_page_break() -> (
    None
):
    sections = Parser(PDF, PARSER / "mapper.csv").parse()
    # Wrap the fixture's heading as other reports wrap long regulation titles.
    sections["capacity_and_capability"] = [
        TextBlock(
            block.page,
            block.text.replace(
                "Regulation 23: Governance and management",
                "Regulation 23: Governance and\nmanagement",
            ),
        )
        for block in sections["capacity_and_capability"]
    ]
    # Registration narratives are not stored, but still end a summary.
    blocks = sections["capacity_and_capability"]
    first_heading = next(
        i for i, block in enumerate(blocks) if block.text.startswith("Regul")
    )
    sections["capacity_and_capability"] = [
        *blocks[:first_heading],
        TextBlock(8, "Registration Regulation 4: Application for registration"),
        TextBlock(8, "The application was made in time.\nJudgment: Compliant"),
        *blocks[first_heading:],
    ]

    rows, _ = extract(sections)
    narrative = next(
        row
        for row in rows
        if row.kind == "narrative" and row.regulation == "Regulation 23"
    )

    assert (narrative.first_page, narrative.last_page) == (9, 10)
    assert narrative.text.startswith(
        "Regulation 23: Governance and\nmanagement"
    )
    assert "An accurate log to track new cases" in narrative.text
    assert narrative.text.endswith("Judgment: Not compliant")
    assert "Page 10 of 34" not in narrative.text
    intro = next(row for row in rows if row.kind == "intro")
    assert (intro.first_page, intro.last_page, intro.regulation) == (5, 6, None)
    assert (
        "Inspectors observed numerous kind and courteous interactions"
        in intro.text
    )
    assert "Capacity and capability" not in intro.text
    # A section's summary runs from its heading to its first regulation
    # heading, across page breaks, and rows come in reading order.
    assert [row.kind for row in rows][:3] == [
        "intro",
        "capacity_summary",
        "narrative",
    ]
    capacity = next(row for row in rows if row.kind == "capacity_summary")
    assert capacity.text.endswith("on the day of\nthe inspection.")
    summary = next(row for row in rows if row.kind == "quality_summary")
    assert (summary.first_page, summary.last_page, summary.regulation) == (
        10,
        12,
        None,
    )
    assert summary.text.startswith("Overall, this inspection found")
    assert summary.text.endswith(
        "discussed under Regulation 28: Fire precautions."
    )
    assert "Quality and safety" not in summary.text
    assert "Page 11 of 34" not in summary.text
    assert summary.page_offsets[0] == summary.text.index(
        "residents' assessment and care planning"
    )
    assert rows[rows.index(summary) + 1].regulation == "Regulation 17"


def test_section_1_response_for_a_regulation() -> None:
    sections = Parser(PDF, PARSER / "mapper.csv").parse()
    blocks = sections["section_1"]
    heading = next(
        i
        for i, block in enumerate(blocks)
        if block.text.startswith("Regulation 25:")
    )
    following = next(
        i
        for i, block in enumerate(blocks)
        if block.text.startswith("Regulation 27:")
    )
    sections["section_1"] = [
        *blocks[: heading - 1],
        # Some PDFs merge a heading into the block before it.
        TextBlock(
            blocks[heading - 1].page,
            f"{blocks[heading - 1].text}\n{blocks[heading].text}",
        ),
        *blocks[heading + 1 : following],
        TextBlock(
            25, "Registration Regulation 4: Application for registration"
        ),
        # Providers repeat the heading they answer, alone or as a label.
        TextBlock(
            26, "Registration Regulation 4: Application for registration:"
        ),
        TextBlock(26, "The registration application will be updated."),
        *blocks[following : following + 3],
        TextBlock(25, "Regulation 27: Infection control\nNot Compliant"),
        TextBlock(
            25,
            "Regulation 27: Infection control - Compliance Plan\n"
            "Curtains are changed monthly.",
        ),
        *blocks[following + 3 :],
        # A heading can also sit inside a block, followed by its response.
        TextBlock(
            28,
            "We will review care plans.\nRegulation 6: Health care\n"
            "We will arrange GP reviews.\n"
            "Registration Regulation 4: Application for registration\n"
            "The registration application was renewed.",
        ),
        # A heading's title can start on the line after its number.
        TextBlock(28, "Regulation 8:\nProtection"),
        TextBlock(28, "Safeguarding training is booked."),
    ]

    rows, uncut = extract(sections)
    responses = [row for row in rows if row.kind == "response"]
    response = next(
        row for row in responses if row.regulation == "Regulation 25"
    )

    assert uncut == {}
    assert (response.first_page, response.last_page) == (24, 24)
    assert response.text.startswith("Regulation 25: Temporary absence or")
    assert "The transfer letter has been amended" in response.text
    assert response.text.endswith("staff at recent meeting.")
    assert "Regulation 27:" not in response.text
    assert "Registration Regulation" not in response.text
    assert not any("registration application" in row.text for row in rows)
    assert response.page_offsets == ()
    food = next(row for row in responses if row.regulation == "Regulation 18")
    assert "Regulation 25:" not in food.text
    (spanning,) = (
        row for row in responses if row.regulation == "Regulation 27"
    )
    assert "Curtains are changed monthly." in spanning.text
    assert spanning.page_offsets == (
        spanning.text.index("The registered provider recognises"),
    )
    rights = next(row for row in responses if row.regulation == "Regulation 9")
    assert rights.text.endswith("We will review care plans.")
    health = next(row for row in responses if row.regulation == "Regulation 6")
    assert (
        health.text == "Regulation 6: Health care\nWe will arrange GP reviews."
    )
    protection = next(
        row for row in responses if row.regulation == "Regulation 8"
    )
    assert protection.text == (
        "Regulation 8:\nProtection\nSafeguarding training is booked."
    )

    # A response that cannot be cut is left out with its reason, and the
    # response before it still ends there.
    sections["section_1"].extend(
        [
            TextBlock(28, "Regulation 11: Visits\nVisiting is open."),
            TextBlock(
                28, "Regulation 10: Communication: staff will be trained."
            ),
            TextBlock(28, "Regulation 16: Training and staff development"),
            TextBlock(28, "Training is booked."),
        ]
    )
    rows, uncut = extract(sections)

    assert uncut == {
        "Regulation 10": "cannot cut response heading",
        "Regulation 16": "repeated response",
    }
    assert [row.regulation for row in rows if row.kind == "response"] == [
        *(
            row.regulation
            for row in responses
            if row.regulation != "Regulation 16"
        ),
        "Regulation 11",
    ]
    assert rows[-1].text == "Regulation 11: Visits\nVisiting is open."
    assert not any("staff will be trained" in row.text for row in rows)


def test_fully_compliant_report_has_no_section_1_responses() -> None:
    sections = Parser(PDF, PARSER / "mapper.csv").parse()
    # Keep the fixture's compliant Staffing narrative and opening narrative;
    # fully compliant reports end at Appendix 1, without a compliance plan.
    sections = {
        "observations": sections["observations"],
        "capacity_and_capability": sections["capacity_and_capability"],
    }
    blocks = sections["capacity_and_capability"]
    start = next(
        i
        for i, block in enumerate(blocks)
        if block.text.startswith("Regulation 15:")
    )
    sections["capacity_and_capability"] = blocks[start : start + 2]

    rows, uncut = extract(sections)

    assert [row.kind for row in rows] == ["intro", "narrative"]
    assert rows[1].text.endswith("Judgment: Compliant")
    assert validate(rows, {"Regulation 15": "Compliant"}, uncut) == ()
    # A missing source response is reported, while its narrative is retained.
    assert validate(rows, {"Regulation 15": "Not compliant"}, uncut) == (
        ("Regulation 15", "response absent from source"),
    )
    assert validate(
        rows,
        {"Regulation 15": "Not compliant"},
        {"Regulation 15": "cannot cut response heading"},
    ) == (("Regulation 15", "cannot cut response heading"),)
