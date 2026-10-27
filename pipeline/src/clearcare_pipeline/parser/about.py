"""Cutting the "About the designated centre" section from a report."""

import re
from collections.abc import Sequence

from clearcare_pipeline.parser.parser import TextBlock
from clearcare_pipeline.parser.text import ReportText

# Stored with every about row. It is separate from text.py's EXTRACTOR_VERSION
# so that adding this step leaves the rows the commitments split and the
# outcome pilot read as they are. Change it with this module.
ABOUT_VERSION = "about-v1"

# Page footers, and the section's own heading, which every report opens with.
_IGNORE = re.compile(
    r"Page\s+\d+\s+of\s+\d+|About the designated centre", re.IGNORECASE
)


def extract_about(blocks: Sequence[TextBlock]) -> ReportText | None:
    """Joins the section's text, recording where each source page starts.

    Returns None when the section has no text, which is the case when the
    report has no such heading.
    """
    parts: list[str] = []
    offsets: list[int] = []
    pages: list[int] = []
    offset = 0
    for block in blocks:
        lines = [
            line.strip()
            for line in block.text.splitlines()
            if line.strip() and not _IGNORE.fullmatch(line.strip())
        ]
        if not lines:
            continue
        part = "\n".join(lines) + "\n"
        parts.append(part)
        offsets.append(offset)
        pages.append(block.page)
        offset += len(part)
    if not parts:
        return None
    text = "".join(parts).rstrip()
    first_page, last_page = pages[0], pages[-1]
    # As in text.py, an empty page shares the next page's offset.
    page_offsets = tuple(
        next(
            start
            for start, page in zip(offsets, pages, strict=True)
            if page >= wanted
        )
        for wanted in range(first_page + 1, last_page + 1)
    )
    return ReportText("about", None, first_page, last_page, text, page_offsets)
