"""Cutting page-bearing report text using text.csv's boundaries."""

from __future__ import annotations

import csv
import re
from bisect import bisect_right
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from clearcare_pipeline.parser.parser import TextBlock

MAPPING = Path(__file__).with_suffix(".csv")
# Stored with every row. Change it with text.csv or this extractor, so that
# the new text is appended; a deploy alone re-extracts nothing.
EXTRACTOR_VERSION = "text-v1"


@dataclass(frozen=True)
class ReportText:
    """One introduction, section summary, inspector narrative or response."""

    kind: str
    regulation: str | None
    first_page: int
    last_page: int
    text: str
    page_offsets: tuple[int, ...]


def extract(
    sections: Mapping[str, Sequence[TextBlock]],
    mapping: Path = MAPPING,
) -> tuple[tuple[ReportText, ...], dict[str, str]]:
    """Cuts the mapped sections, retaining the pages of their actual text.

    Returns the rows, and why each response that cannot be cut was left out.

    Raises:
        ValueError: If an introduction or narratives are absent, or a
            narrative is repeated or has no closing judgment.
    """
    rows: list[ReportText] = []
    uncut: dict[str, str] = {}
    with mapping.open(newline="", encoding="utf-8") as handle:
        rules = csv.DictReader(
            line for line in handle if not line.startswith("#")
        )
        for rule in rules:
            blocks = sections.get(rule["location"], ())
            text, offsets, pages = _join(blocks, rule["ignore"])
            if not text:
                continue
            # The mapping matches the whole heading so a wrapped reference
            # to a regulation in a paragraph is not treated as a new narrative.
            # Some PDFs print a Section 1 heading inside a block of other
            # text, so there each line is tried too. Narratives and summaries
            # are prose that may end a paragraph with a regulation's name, so
            # there only a whole block is a heading.
            headings = _headings(text, offsets, rule["kind"] == "response")
            starts: list[tuple[int, str | None]] = []
            if rule["start"]:
                opened = None
                for offset, heading, whole_block in headings:
                    match = re.fullmatch(rule["start"], heading)
                    if not rule["boundary"]:
                        if match:
                            starts.append((offset, _regulation(match)))
                        continue
                    # A label opens with a heading and goes on in the same
                    # line. Inside a block, providers use labels to sum up
                    # other regulations, so only one that opens a block
                    # closes the response before it.
                    whole = re.fullmatch(rule["boundary"], heading)
                    found = whole
                    if whole is None and whole_block:
                        found = re.match(rule["boundary"], heading)
                    if found is None:
                        continue
                    regulation = _regulation(found)
                    if regulation == opened:
                        # The provider repeated the heading it is answering.
                        continue
                    opened = regulation
                    if whole is None and re.match(rule["start"], heading):
                        # Text after another regulation's label could be its
                        # response or more of the open one.
                        uncut[regulation] = "cannot cut response heading"
                    # An excluded heading, or a label, closes the preceding
                    # response.
                    starts.append((offset, regulation if match else None))
            # Without a start heading, a rule takes the section's text up to
            # its first boundary heading. A section with none, as in some
            # short focused inspections, is all summary.
            until = next(
                (
                    offset
                    for offset, heading, _ in headings
                    if rule["boundary"]
                    and re.fullmatch(rule["boundary"], heading)
                ),
                len(text),
            )
            spans = (
                ([(0, until, None)] if until else [])
                if not rule["start"]
                else [
                    (
                        start,
                        starts[index + 1][0]
                        if index + 1 < len(starts)
                        else len(text),
                        regulation,
                    )
                    for index, (start, regulation) in enumerate(starts)
                ]
            )
            # A narrative may quote another heading, even as a whole block;
            # only its mapped judgment closes it.
            consumed = 0
            for first, last, regulation in spans:
                if rule["start"] and regulation is None:
                    continue
                if first < consumed:
                    continue
                if rule["end"]:
                    end = re.search(rule["end"], text[first:], re.MULTILINE)
                    if end is None:
                        raise ValueError(
                            f"{regulation}: missing closing judgment"
                        )
                    last = first + end.end()
                    consumed = last
                content = text[first:last].rstrip()
                last = first + len(content)
                first_page = pages[bisect_right(offsets, first) - 1]
                last_page = pages[bisect_right(offsets, last - 1) - 1]
                rows.append(
                    ReportText(
                        rule["kind"],
                        regulation,
                        first_page,
                        last_page,
                        content,
                        tuple(
                            next(
                                offset - first
                                for offset, source_page in zip(
                                    offsets, pages, strict=True
                                )
                                if source_page >= page and offset >= first
                            )
                            for page in range(first_page + 1, last_page + 1)
                        ),
                    )
                )
    for kind in ("intro", "narrative"):
        if not any(row.kind == kind for row in rows):
            raise ValueError(f"no {kind} text found")
    counts = Counter((row.kind, row.regulation) for row in rows)
    for row in rows:
        if counts[row.kind, row.regulation] == 1:
            continue
        if row.kind != "response" or row.regulation is None:
            raise ValueError(f"repeated {row.kind}: {row.regulation}")
        # The text between two starts of one regulation cannot be placed.
        uncut[row.regulation] = "repeated response"
    return (
        tuple(row for row in rows if counts[row.kind, row.regulation] == 1),
        uncut,
    )


def _headings(
    text: str,
    offsets: Sequence[int],
    lines: bool,
) -> list[tuple[int, str, bool]]:
    """Lists the text a heading is matched against, where it starts.

    That is each block, as a heading may wrap over its lines, and with lines
    each line on its own. The flag marks a whole block.
    """
    headings: list[tuple[int, str, bool]] = []
    for offset, end in zip(offsets, [*offsets[1:], len(text)], strict=True):
        block = text[offset:end].strip()
        if not lines:
            headings.append((offset, block, True))
            continue
        # The first line comes before the block, so that a heading followed
        # by its response in one block is not taken for a label.
        first, *rest = block.split("\n")
        headings += [(offset, first, False), (offset, block, True)]
        line = offset + len(first) + 1
        for part in rest:
            headings.append((line, part, False))
            line += len(part) + 1
    return headings


def _regulation(match: re.Match[str]) -> str:
    return " ".join(match.group("regulation").split())


def _join(
    blocks: Sequence[TextBlock],
    ignore: str,
) -> tuple[str, list[int], list[int]]:
    """Joins cleaned blocks, recording where each source page starts."""
    parts: list[str] = []
    offsets: list[int] = []
    pages: list[int] = []
    offset = 0
    for block in blocks:
        lines = [
            line.strip()
            for line in block.text.splitlines()
            if line.strip() and not re.fullmatch(ignore, line.strip())
        ]
        if not lines:
            continue
        part = "\n".join(lines) + "\n"
        parts.append(part)
        offsets.append(offset)
        pages.append(block.page)
        offset += len(part)
    return "".join(parts), offsets, pages


def validate(
    rows: Sequence[ReportText],
    judgments: Mapping[str, str],
    uncut: Mapping[str, str],
) -> tuple[tuple[str, str], ...]:
    """Checks narratives and returns each missing response with its reason.

    Raises:
        ValueError: If narratives are missing or extra, or responses are extra.
    """
    if not judgments:
        raise ValueError("no Appendix 1 regulations found")
    for kind, expected in (
        ("narrative", set(judgments)),
        (
            "response",
            {
                regulation
                for regulation, judgment in judgments.items()
                if judgment.casefold() != "compliant"
            },
        ),
    ):
        actual = {row.regulation for row in rows if row.kind == kind}
        missing = sorted(expected - actual)
        extra = sorted(str(regulation) for regulation in actual - expected)
        if (kind == "narrative" and missing) or extra:
            raise ValueError(
                f"{kind} differs from Appendix 1: "
                f"missing {missing}, extra {extra}"
            )
    return tuple(
        (regulation, uncut.get(regulation, "response absent from source"))
        for regulation in missing
    )
