# Builds the report PDFs the field-extraction tests parse. The pages copy the
# shapes a HIQA report uses (a label/value cover, a table whose label runs over
# two rows, a two-row table header, a table grouped by dimension, and a table
# that repeats a merged cell's value across its columns), with invented values
# so no real report or personal name is stored in the repository.

# PyMuPDF leaves some members unannotated; scoped to this module as in
# parser.py.
# pyright: reportUnknownMemberType=false, reportUnknownArgumentType=false

from collections.abc import Sequence
from pathlib import Path

import pymupdf

Rows = Sequence[Sequence[str | None]]

_WIDTH = 590.0
_PLAN_WIDTH = 900.0
_HEIGHT = 842.0
_X = 60.0
_TOP = 60.0


def _grid(
    page: pymupdf.Page,
    top: float,
    rows: Rows,
    columns: int,
    column_width: float,
    row_height: float,
    fontsize: float = 8.0,
) -> None:
    """Draws rows as a ruled grid and writes each cell's text into its box."""
    for index, row in enumerate(rows):
        y = top + index * row_height
        for column in range(columns):
            x = _X + column * column_width
            cell = pymupdf.Rect(x, y, x + column_width, y + row_height)
            page.draw_rect(cell)
            text = row[column] if column < len(row) else None
            if text:
                page.insert_textbox(
                    pymupdf.Rect(
                        x + 2, y + 1, x + column_width - 2, y + row_height - 2
                    ),
                    text,
                    fontsize=fontsize,
                )


COVER: Rows = (
    ("Name of designated centre:", "Fern Valley Nursing Home"),
    ("Name of provider:", "Fern Valley Care Limited"),
    ("Address of centre:", "Sample Street, Carlow"),
    ("Type of inspection:", "Unannounced"),
    ("Date of inspection:", "13 May 2026"),
    ("Centre ID:", "OSV-0000238"),
    ("Fieldwork ID:", "MON-0050709"),
)

# The label runs over the first two rows; the value sits two columns right.
RESIDENTS: Rows = (
    (None, "Number of residents on the", None, "48"),
    (None, "date of inspection:", None, None),
)

# A two-row header, and data rows with the merged cells left empty.
INSPECTORS: Rows = (
    ("Date", None, "Times of", None, "Inspector", "Role"),
    (None, None, "Inspection", None, None, None),
    (
        "Wednesday 13 May 2026",
        "08:50hrs to 18:20hrs",
        None,
        None,
        "A. Inspector",
        "Lead",
    ),
    (
        "Wednesday 13 May 2026",
        "08:50hrs to 18:20hrs",
        None,
        None,
        "B. Inspector",
        "Support",
    ),
)

# A row with one cell is a dimension; the rows that follow belong to it.
APPENDIX: Rows = (
    (None, "Regulation Title", None, None, "Judgment", None),
    ("Capacity and capability", None, None, None, None, None),
    ("Regulation 15: Staffing", None, None, "Compliant", None, None),
    (
        "Regulation 16: Training and staff development",
        None,
        None,
        "Not compliant",
        None,
        None,
    ),
    ("Quality and safety", None, None, None, None, None),
    ("Regulation 17: Premises", None, None, "Not compliant", None, None),
)

# The risk rating is written into two columns; the values repeat.
COMPLIANCE_PLAN: Rows = (
    (
        "Regulation",
        None,
        "Regulatory",
        None,
        "Judgment",
        None,
        "Risk",
        None,
        None,
        None,
        "Date to be",
        None,
    ),
    (
        None,
        None,
        "requirement",
        None,
        None,
        None,
        "rating",
        None,
        None,
        None,
        "complied with",
        None,
    ),
    (
        "Regulation 16(1)(a)",
        "Staff receive appropriate training.",
        None,
        None,
        "Not Compliant",
        "Orange",
        "Orange",
        None,
        None,
        "01/09/2026",
        None,
        None,
    ),
    (
        "Regulation 17(1)",
        "The premises suit the residents' needs.",
        None,
        None,
        "Substantially Compliant",
        "Yellow",
        None,
        None,
        None,
        "01/09/2026",
        None,
        None,
    ),
    # This row runs over the page break: the rest of its requirement and of
    # its judgment are printed again at the top of the next page.
    (
        "Regulation 18(1)",
        "The provider shall ensure that the",
        None,
        None,
        "Substantially",
        "Yellow",
        None,
        None,
        None,
        "01/09/2026",
        None,
        None,
    ),
)

# What the row above continues into: the requirement and the judgment, with
# nothing in the column that starts a record. The next page prints the table
# with one cell per column, where the page above merged them.
COMPLIANCE_PLAN_CONTINUED: Rows = (
    (
        None,
        "premises are kept clean.",
        "Compliant",
        None,
        None,
    ),
)


def write_report_pdf(path: Path) -> None:
    """Writes a small report with one page per shape the mapper reads.

    The pages carry the headings mapper.csv matches, so a field's section
    resolves to the same page here as in a real report.
    """
    document = pymupdf.open()
    try:
        cover = document.new_page(width=_WIDTH, height=_HEIGHT)
        cover.insert_text(
            (_X, _TOP),
            "Report of an inspection of a Designated Centre",
            fontsize=11,
        )
        _grid(cover, 90, COVER, columns=2, column_width=180, row_height=24)

        about = document.new_page(width=700, height=_HEIGHT)
        about.insert_text(
            (_X, _TOP), "About the designated centre", fontsize=11
        )
        _grid(
            about,
            120,
            RESIDENTS,
            columns=4,
            column_width=150,
            row_height=22,
            fontsize=7,
        )

        process = document.new_page(width=700, height=_HEIGHT)
        process.insert_text((_X, _TOP), "How we inspect", fontsize=11)

        inspectors = document.new_page(width=900, height=_HEIGHT)
        _grid(
            inspectors,
            _TOP,
            INSPECTORS,
            columns=6,
            column_width=130,
            row_height=24,
            fontsize=7,
        )

        appendix = document.new_page(width=1240, height=_HEIGHT)
        appendix.insert_text(
            (_X, _TOP),
            "Appendix 1 - Full list of regulations considered",
            fontsize=11,
        )
        _grid(
            appendix,
            90,
            APPENDIX,
            columns=6,
            column_width=190,
            row_height=24,
            fontsize=7,
        )

        plan_header = document.new_page(width=_PLAN_WIDTH, height=_HEIGHT)
        plan_header.insert_text(
            (_X, _TOP), "Compliance Plan for Fern Valley", fontsize=11
        )
        plan_header.insert_text(
            (_X, _TOP + 30), "Inspection ID: MON-0050709", fontsize=10
        )
        plan_header.insert_text(
            (_X, _TOP + 50), "Date of inspection: 13/05/2026", fontsize=10
        )

        plan = document.new_page(width=940, height=_HEIGHT)
        plan.insert_text((_X, _TOP), "Section 2", fontsize=11)
        _grid(
            plan,
            90,
            COMPLIANCE_PLAN,
            columns=12,
            column_width=72,
            row_height=36,
            fontsize=7,
        )

        # The next page carries on the last row of the plan, as a real report
        # does when a row runs over the page break. It prints the table with
        # one cell per column, so its columns are not the page's merged ones.
        continued = document.new_page(width=940, height=_HEIGHT)
        _grid(
            continued,
            90,
            COMPLIANCE_PLAN_CONTINUED,
            columns=5,
            column_width=180,
            row_height=36,
            fontsize=7,
        )

        document.save(str(path))
    finally:
        document.close()
