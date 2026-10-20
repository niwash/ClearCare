"""Section-aware parsing of HIQA inspection reports (CCARE-35).

The report layout is described by a mapping file rather than hard-coded in
the parser, so a change to the layout can be handled by editing the mapping.
Every block of text is stored under the section whose heading it follows,
together with the page it was read from.

With ``--fields``, a second mapping (fields.py) reads key values and record
tables out of those sections (CCARE-34).
"""

# PyMuPDF ships py.typed but leaves some members unannotated: the
# `Document.page_count` property and `Page.get_text`. Strict mode reports
# those as unknown, so they are scoped to this module rather than the whole
# project. The block type is still pinned with a cast below.
# pyright: reportUnknownMemberType=false, reportUnknownArgumentType=false

from __future__ import annotations

import argparse
import csv
import json
import logging
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import cast

import pymupdf

from clearcare_pipeline.parser.fields import extract, load_fields

logger = logging.getLogger(__name__)

# A text block as returned by PyMuPDF's "blocks" mode: x0, y0, x1, y1, text.
TextBlockTuple = tuple[float, float, float, float, str]


@dataclass(frozen=True)
class Section:
    """A section heading and the key its text is stored under."""

    pattern: str
    key: str
    # A whole line that starts the section inside a larger block, if any.
    line: str = ""


@dataclass(frozen=True)
class TextBlock:
    """A piece of report text and the page it was read from."""

    page: int
    text: str


def load_mapping(path: Path) -> list[Section]:
    """Reads the section mapping from a CSV file.

    The file has a header row and one row per section: the text that starts
    the section, the key its text is stored under and, optionally, a regular
    expression for a whole line that starts the section inside a block.

    Raises:
        ValueError: If a row does not have two non-empty columns.
    """
    sections: list[Section] = []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        next(reader, None)  # Discard the header row.
        for number, row in enumerate(reader, start=2):
            if not any(cell.strip() for cell in row):
                continue
            if len(row) < 2 or not row[0].strip() or not row[1].strip():
                raise ValueError(
                    f"{path.name} line {number}: expected two columns"
                )
            line = row[2].strip() if len(row) > 2 else ""
            sections.append(Section(row[0].strip(), row[1].strip(), line))
    return sections


class Parser:
    """Parses a report into sections using a mapping file."""

    def __init__(self, pdf_path: Path, mapping_path: Path) -> None:
        """Loads the section mapping and remembers the report to parse.

        Raises:
            ValueError: If the mapping file has no usable rows.
        """
        self._pdf_path = pdf_path
        self._sections = load_mapping(mapping_path)
        if not self._sections:
            raise ValueError(f"no sections in mapping: {mapping_path}")

    def parse(self) -> dict[str, list[TextBlock]]:
        """Returns the text of every section, in reading order.

        Headings are matched against the start of each text block, or a line
        inside one that the mapping's whole-line pattern matches. A report
        lists its sections in the mapping order, so a heading only starts a
        new section when it comes after the current one. This keeps the
        "Capacity and capability" and "Quality and safety" labels repeated in
        the Appendix 1 table from switching out of the appendix.
        """
        parsed: dict[str, list[TextBlock]] = {
            section.key: [] for section in self._sections
        }
        current = -1
        document = pymupdf.open(str(self._pdf_path))
        try:
            for number in range(document.page_count):
                page = document[number]
                blocks = cast("list[TextBlockTuple]", page.get_text("blocks"))
                for block in blocks:
                    text = block[4].strip()
                    if not text:
                        continue
                    for part in self._split(text):
                        current = self._match(part, current)
                        if current >= 0:
                            key = self._sections[current].key
                            parsed[key].append(TextBlock(number + 1, part))
        finally:
            document.close()
        return parsed

    def _split(self, text: str) -> list[str]:
        """Splits a block before each line that is a section heading.

        Some PDFs print a heading as one line of a larger block. Only a whole
        line counts, because the compliance plan's instructions also start a
        line with "Section 1".
        """
        lines = text.splitlines(keepends=True)
        cuts = [
            index
            for index, line in enumerate(lines)
            if index == 0
            or any(
                section.line and re.fullmatch(section.line, line.strip())
                for section in self._sections
            )
        ]
        return [
            "".join(lines[start:end]).strip()
            for start, end in zip(cuts, [*cuts[1:], len(lines)], strict=True)
        ]

    def _match(self, text: str, current: int) -> int:
        """Returns the index of the section the text starts, if any.

        Only sections after the current one are considered, so repeated
        headings cannot move the parser backwards. The match is
        case-sensitive because report headings are capitalised, whereas a
        body sentence that mentions a section (for example "compliance plan
        following inspection") is not.
        """
        for index, section in enumerate(self._sections):
            if index > current and text.startswith(section.pattern):
                return index
        return current


def main(argv: list[str] | None = None) -> int:
    """Parses a report and writes its sections, and any values, to JSON."""
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    if not args.pdf_path.is_file():
        logger.error("PDF file not found: %s", args.pdf_path)
        return 1
    if not args.mapper_path.is_file():
        logger.error("Mapping file not found: %s", args.mapper_path)
        return 1
    if args.fields is not None and not args.fields.is_file():
        logger.error("Value mapping not found: %s", args.fields)
        return 1

    logger.info("Parsing %s...", args.pdf_path.name)
    sections = Parser(args.pdf_path, args.mapper_path).parse()
    payload: dict[str, object] = {
        key: [asdict(block) for block in blocks]
        for key, blocks in sections.items()
    }
    if args.fields is not None:
        try:
            report = extract(args.pdf_path, sections, load_fields(args.fields))
        except ValueError as problem:
            logger.error("%s", problem)
            return 1
        payload = {
            "fields": report.fields,
            "records": report.records,
        }
    output: Path = args.output or (
        Path.cwd() / f"{args.pdf_path.stem}_parsed.json"
    )
    output.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    logger.info("Saved parsed data to %s", output)
    return 0


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    """Returns the command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Parse a HIQA report PDF using a CSV section mapping."
    )
    parser.add_argument("pdf_path", type=Path, help="Path to the PDF to parse")
    parser.add_argument(
        "mapper_path", type=Path, help="Path to the CSV section mapping"
    )
    parser.add_argument(
        "--fields",
        type=Path,
        default=None,
        help="also read the values in this CSV mapping",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Where to write the JSON (default: ./<name>_parsed.json)",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    sys.exit(main())
