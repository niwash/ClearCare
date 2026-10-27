"""Tests for cutting the About section out of a report."""

from clearcare_pipeline.parser.about import extract_about
from clearcare_pipeline.parser.parser import TextBlock


def test_section_text_is_joined_without_headings_or_footers() -> None:
    blocks = [
        TextBlock(2, "About the designated centre\n"),
        TextBlock(2, "The centre has a garden.\nIt has twin rooms.\n"),
        TextBlock(2, "Page 2 of 20\n"),
    ]

    about = extract_about(blocks)

    assert about is not None
    assert about.kind == "about"
    assert about.regulation is None
    assert about.text == "The centre has a garden.\nIt has twin rooms."
    assert (about.first_page, about.last_page) == (2, 2)
    assert about.page_offsets == ()


def test_a_section_over_two_pages_records_where_the_second_starts() -> None:
    blocks = [
        TextBlock(2, "First page text.\n"),
        TextBlock(3, "Second page text.\n"),
    ]

    about = extract_about(blocks)

    assert about is not None
    assert (about.first_page, about.last_page) == (2, 3)
    assert about.page_offsets == (len("First page text.\n"),)
    assert about.text[about.page_offsets[0] :] == "Second page text."


def test_an_empty_page_shares_the_next_pages_offset() -> None:
    blocks = [TextBlock(2, "One.\n"), TextBlock(4, "Three.\n")]

    about = extract_about(blocks)

    assert about is not None
    assert about.page_offsets == (len("One.\n"), len("One.\n"))


def test_a_section_with_only_headings_has_no_text() -> None:
    blocks = [TextBlock(2, "About the designated centre\nPage 2 of 20\n")]

    assert extract_about(blocks) is None
    assert extract_about([]) is None
