"""Rules for commitments in short Section 1 responses."""

from datetime import date

import pytest

from clearcare_pipeline.parser.commitments import split


def test_several_commitments_keep_their_own_dates_and_sub_regulations() -> None:
    text = (
        "Regulation 17: Premises\n"
        "17(1): Following the inspection on 12 January 2025, "
        "we will replace the carpets by 31 March 2025.\n"
        "17(2): The new chairs will be delivered and installed. "
        "Timeframe: 31 December 2025."
    )

    rows = split(text)

    assert len(rows) == 2
    assert [row.sub_regulation for row in rows] == ["17(1)", "17(2)"]
    assert [row.stated_deadline for row in rows] == [
        date(2025, 3, 31),
        date(2025, 12, 31),
    ]
    assert [row.stated_deadline_text for row in rows] == [
        "31 March 2025",
        "31 December 2025",
    ]
    assert rows[0].start_offset == 0
    assert rows[1].end_offset == len(text)
    for row in rows:
        assert text[row.start_offset : row.end_offset] == row.text
    assert [
        row.stated_deadline for row in split(text.replace("by ", "by\n"))
    ] == [row.stated_deadline for row in rows]
    assert split("The work will be completed on 31 March 2025.")[
        0
    ].stated_deadline == date(2025, 3, 31)
    uncertain = (
        "Following the inspection on 12 January 2025, "
        "we will replace the carpets."
    )
    assert split(uncertain)[0].stated_deadline is None
    assert split(uncertain)[0].text == uncertain


def test_undetected_commitment_keeps_the_whole_response_without_a_date() -> (
    None
):
    text = (
        "Regulation 16: Training and staff development\n"
        "The training review took place on 12 January 2025. "
        "Refresher training is ongoing."
    )

    rows = split(text)

    assert len(rows) == 1
    assert (rows[0].start_offset, rows[0].end_offset, rows[0].text) == (
        0,
        len(text),
        text,
    )
    assert rows[0].stated_deadline is None
    assert rows[0].stated_deadline_text is None


def test_bullets_share_the_date_that_introduces_the_list() -> None:
    text = (
        "The following works will be completed by March 2026:\n"
        "• 28(1)(c): Replace the damaged fire doors.\n"
        "• Update the evacuation maps.\n\n"
        "We will replace the windows by 31 December 2026."
    )

    rows = split(text)

    assert len(rows) == 3
    assert [row.sub_regulation for row in rows] == ["28(1)(c)", None, None]
    assert [row.stated_deadline for row in rows] == [
        date(2026, 3, 31),
        date(2026, 3, 31),
        date(2026, 12, 31),
    ]
    assert [row.stated_deadline_text for row in rows] == [
        "March 2026",
        "March 2026",
        "31 December 2026",
    ]
    assert [row.deadline_precision for row in rows] == ["month", "month", "day"]
    assert rows[1].text == "• Update the evacuation maps."
    assert rows[2].text == "We will replace the windows by 31 December 2026."


@pytest.mark.parametrize(
    ("first", "second"), [("1.", "2."), ("1)", "2)"), ("a.", "b.")]
)
def test_numbered_items_share_the_date_that_introduces_the_list(
    first: str, second: str
) -> None:
    text = (
        "The following will be done by 31 August 2026:\n"
        f"{first} We will repair the roof.\n"
        f"{second} We will replace the lighting."
    )

    rows = split(text)

    assert [row.text for row in rows] == [
        f"The following will be done by 31 August 2026:\n"
        f"{first} We will repair the roof.",
        f"{second} We will replace the lighting.",
    ]
    assert [row.stated_deadline for row in rows] == [
        date(2026, 8, 31),
        date(2026, 8, 31),
    ]


def test_a_sentence_ending_in_a_year_still_ends_there() -> None:
    text = (
        "We will finish the works in 2026. "
        "The roof will be replaced by 31 August 2026."
    )

    rows = split(text)

    assert [row.text for row in rows] == [
        "We will finish the works in 2026.",
        "The roof will be replaced by 31 August 2026.",
    ]
    assert [row.stated_deadline for row in rows] == [None, date(2026, 8, 31)]


def test_a_number_ending_a_sentence_mid_paragraph_does_not_start_an_item() -> (
    None
):
    text = (
        "We will update the fire register, see item 2. "
        "The register will be reviewed by 31 August 2026. "
        "We will train staff by 30 September 2026."
    )

    rows = split(text)

    # An item would absorb the next sentence on its line.
    assert [row.text for row in rows] == [
        "We will update the fire register, see item 2.",
        "The register will be reviewed by 31 August 2026.",
        "We will train staff by 30 September 2026.",
    ]


@pytest.mark.parametrize(
    ("label", "deadline"),
    [
        ("Time Frame: 15/08/2024", date(2024, 8, 15)),
        ("Time frame: 31 October 2024", date(2024, 10, 31)),
        ("Timeframe: 15/08/2024", date(2024, 8, 15)),
    ],
)
def test_a_time_frame_label_dates_the_commitment_before_it(
    label: str, deadline: date
) -> None:
    rows = split(f"We will repair the roof.\n{label}")

    assert len(rows) == 1
    assert rows[0].stated_deadline == deadline
    assert rows[0].stated_deadline_text == label.split(": ")[1]
    assert rows[0].deadline_precision == "day"


@pytest.mark.parametrize("label", ["Time Frame", "Timeframe"])
def test_a_time_frame_line_ends_before_the_next_commitment(label: str) -> None:
    text = (
        "We will repair the roof.\n"
        f"{label}: 15/08/2024\n"
        "We will replace the lights by 31 October 2024."
    )

    rows = split(text)

    assert [row.text for row in rows] == [
        f"We will repair the roof.\n{label}: 15/08/2024",
        "We will replace the lights by 31 October 2024.",
    ]
    assert [row.stated_deadline for row in rows] == [
        date(2024, 8, 15),
        date(2024, 10, 31),
    ]


def test_a_completed_time_frame_is_not_a_deadline() -> None:
    # A word between the label and its date leaves no cue (ADR-0017).
    rows = split("We will repair the roof.\nTime Frame: Completed 31/7/2024")

    assert rows[0].stated_deadline is None
