"""Extracting key values and record tables from a HIQA report (CCARE-34).

A report's values are described in a CSV, as its sections are (CCARE-35), so a
change to the layout is a change to the file rather than to this module. A
value is read from a table cell, a label in the section's text, or a regular
expression; the rows of a table become a list of records.

A field names the section its value is in, so the same file reads every
report, whatever page each section starts on.

The appendix lists the 2015 registration regulations ("Registration
Regulation 4" and "Registration Regulation 7": renewal applications and
variation of conditions) beside the care regulations. The mapping's
``^Regulation [0-9]`` pattern leaves them out on purpose, because they are not
the care regulations the inspection reports on; reading them would need that
group's ``dimension`` column, which is what tells the two apart.
"""

# PyMuPDF leaves some members unannotated: the page's `find_tables` and
# `get_text` results. They are scoped to this module and cast below, as in
# parser.py.
# pyright: reportUnknownMemberType=false, reportUnknownArgumentType=false

from __future__ import annotations

import csv
import re
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any, Final, cast

import pymupdf

if TYPE_CHECKING:
    from clearcare_pipeline.parser.parser import TextBlock

KINDS: Final = ("field", "record")
SOURCES: Final = ("label", "regex", "table_cell", "table_row")
TRANSFORM_NAMES: Final = (
    "none",
    "strip",
    "join_lines",
    "collapse_ws",
    "int",
    "upper",
    "title",
)
COLUMNS: Final = (
    "kind",
    "group",
    "key",
    "location",
    "source",
    "match",
    "index",
    "transform",
)
# What a section's pages hold, as PyMuPDF reads them.
TextBlockTuple = tuple[float, float, float, float, str]

# A value as the output holds it, and a table row read as one record.
Value = str | int | None
Record = dict[str, Value]
# A table as PyMuPDF's find_tables returns it: rows of cells, each of which is
# None where the layout leaves a space.
Table = Sequence[Sequence[str | None]]


@dataclass(frozen=True)
class Field:
    """One value to take from a report, and how to take it."""

    kind: str
    group: str
    key: str
    location: str
    source: str
    match: str
    index: int | None
    transform: str


@dataclass(frozen=True)
class Report:
    """The values and the record tables read from one report."""

    fields: dict[str, Value]
    records: dict[str, list[Record]]


def load_fields(path: Path) -> tuple[Field, ...]:
    """Reads the value mapping from a CSV file.

    The file has a header row and one row per value: what kind of value it is,
    where it is, how to read it, and what to do with what is read. A line
    whose first cell starts with ``#`` is a comment, so a decision the mapping
    takes can be written beside the row it is about.

    Raises:
        ValueError: If the header is not COLUMNS or a row is not usable.
    """
    fields: list[Field] = []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        header = tuple(next(reader, ()))
        if header != COLUMNS:
            raise ValueError(
                f"{path.name} line 1: expected {','.join(COLUMNS)}"
            )
        for number, row in enumerate(reader, start=2):
            if not any(cell.strip() for cell in row):
                continue
            if row[0].lstrip().startswith("#"):
                continue
            fields.append(_field(path.name, number, row))
    if not fields:
        raise ValueError(f"no fields in mapping: {path}")
    _check_groups(path.name, fields)
    return tuple(fields)


def _field(name: str, number: int, row: Sequence[str]) -> Field:
    """Returns the field a mapping row describes.

    Raises:
        ValueError: If the row is not in the expected form.
    """
    if len(row) != len(COLUMNS):
        raise ValueError(
            f"{name} line {number}: expected {len(COLUMNS)} columns,"
            f" got {len(row)}"
        )
    cells = {
        column: value.strip()
        for column, value in zip(COLUMNS, row, strict=True)
    }

    def bad(problem: str) -> ValueError:
        return ValueError(f"{name} line {number}: {problem}")

    if cells["kind"] not in KINDS:
        raise bad(f"kind must be one of {', '.join(KINDS)}")
    if cells["source"] not in SOURCES:
        raise bad(f"source must be one of {', '.join(SOURCES)}")
    transform = cells["transform"] or "none"
    if transform not in TRANSFORM_NAMES:
        raise bad(f"unknown transform: {cells['transform']}")
    if not cells["key"]:
        raise bad("key is empty")
    if cells["kind"] == "record" and not cells["group"]:
        raise bad("a record needs a group")
    if cells["kind"] == "field" and cells["group"]:
        raise bad("a field must not have a group")
    if cells["source"] == "table_row" and cells["kind"] != "record":
        raise bad("table_row is only for a record")
    index = None
    if cells["index"]:
        if not cells["index"].isdigit():
            raise bad(f"index is not a number: {cells['index']}")
        index = int(cells["index"])
    return Field(
        kind=cells["kind"],
        group=cells["group"],
        key=cells["key"],
        location=cells["location"],
        source=cells["source"],
        match=cells["match"],
        index=index,
        transform=transform,
    )


def _check_groups(name: str, fields: Sequence[Field]) -> None:
    """Checks that each record group is consistent.

    Raises:
        ValueError: If a group reads more than one location, has more than
            one value read from a table's stand-alone marker row, or reads no
            table column at all.
    """
    groups: dict[str, list[Field]] = {}
    for field in fields:
        if field.kind == "record":
            groups.setdefault(field.group, []).append(field)
    for group, members in groups.items():
        locations = {field.location for field in members}
        if len(locations) > 1:
            raise ValueError(
                f"{name}: group {group} reads more than one location:"
                f" {', '.join(sorted(locations))}"
            )
        carried = [field for field in members if field.index is None]
        if len(carried) > 1:
            raise ValueError(
                f"{name}: group {group} has more than one marker value:"
                f" {', '.join(field.key for field in carried)}"
            )
        if all(field.index is None for field in members):
            raise ValueError(f"{name}: group {group} reads no table column")


def _unchanged(value: Value) -> Value:
    return value


def _strip(value: Value) -> Value:
    return value.strip() if isinstance(value, str) else value


def _join_lines(value: Value) -> Value:
    if not isinstance(value, str):
        return value
    return " ".join(value.split("\n")).strip()


def _collapse(value: Value) -> Value:
    return " ".join(value.split()) if isinstance(value, str) else value


def _as_int(value: Value) -> Value:
    text = " ".join(value.split()) if isinstance(value, str) else ""
    return int(text) if text.isdigit() else None


def _upper(value: Value) -> Value:
    return value.upper() if isinstance(value, str) else value


def _title(value: Value) -> Value:
    return value.title() if isinstance(value, str) else value


TRANSFORMS: Mapping[str, Callable[[Value], Value]] = {
    "none": _unchanged,
    "strip": _strip,
    "join_lines": _join_lines,
    "collapse_ws": _collapse,
    "int": _as_int,
    "upper": _upper,
    "title": _title,
}


def extract(
    pdf_path: Path,
    sections: Mapping[str, Sequence[TextBlock]],
    fields: Sequence[Field],
) -> Report:
    """Reads every value and record the fields describe from the report.

    Raises:
        ValueError: If a field names a section the report does not have, or
            names pages the report does not have.
    """
    document = pymupdf.open(str(pdf_path))
    try:
        pages = {
            location: _pages(location, sections, document.page_count)
            for location in {field.location for field in fields}
        }
        tables = _tables(document)
        blocks = _blocks(document)
        values = {
            field.key: _scalar(field, pages[field.location], tables, blocks)
            for field in fields
            if field.kind == "field"
        }
        records = {
            group[0].group: _records(group, pages[group[0].location], tables)
            for group in _groups(fields)
        }
        return Report(values, records)
    finally:
        document.close()


def _groups(fields: Sequence[Field]) -> list[list[Field]]:
    """Returns the record fields, grouped by group, in file order."""
    grouped: dict[str, list[Field]] = {}
    for field in fields:
        if field.kind == "record":
            grouped.setdefault(field.group, []).append(field)
    return list(grouped.values())


def _pages(
    location: str,
    sections: Mapping[str, Sequence[TextBlock]],
    page_count: int,
) -> list[int]:
    """Returns the pages a location covers.

    A location is a section's key, whose pages are the ones its text was read
    from, or ``pages:5`` or ``pages:5-7`` for a value that is in no section.

    Raises:
        ValueError: If the location names no section, or pages outside the
            report.
    """
    if location.startswith("pages:"):
        return _page_range(location.removeprefix("pages:"), page_count)
    if location in sections:
        return sorted({block.page for block in sections[location]})
    raise ValueError(f"unknown location: {location}")


def _page_range(spec: str, page_count: int) -> list[int]:
    """Returns the pages of a ``5`` or ``5-7`` specification.

    Raises:
        ValueError: If the pages are not within the report.
    """
    first_text, _, last_text = spec.partition("-")
    first = int(first_text)
    last = int(last_text) if last_text else first
    if not 1 <= first <= last <= page_count:
        raise ValueError(f"pages outside the report: {spec}")
    return list(range(first, last + 1))


def _tables(document: pymupdf.Document) -> dict[int, list[Table]]:
    """Returns each page's tables, by page number (the first page is 1)."""
    found: dict[int, list[Table]] = {}
    for number in range(document.page_count):
        page = document[number]
        finder = cast("Any", page.find_tables())
        found[number + 1] = [
            cast("Table", table.extract()) for table in finder.tables
        ]
    return found


def _blocks(document: pymupdf.Document) -> dict[int, list[str]]:
    """Returns each page's text blocks, by page number."""
    text: dict[int, list[str]] = {}
    for number in range(document.page_count):
        page = document[number]
        blocks = cast("list[TextBlockTuple]", page.get_text("blocks"))
        text[number + 1] = [
            block[4].strip() for block in blocks if block[4].strip()
        ]
    return text


def _scalar(
    field: Field,
    pages: Sequence[int],
    tables: Mapping[int, Sequence[Table]],
    blocks: Mapping[int, Sequence[str]],
) -> Value:
    """Returns one field's value, or None if the report does not have it."""
    text: str | None
    if field.source == "table_cell":
        text = _first(
            pages,
            lambda page: _cell_value(tables.get(page, ()), field.match),
        )
    elif field.source == "label":
        text = _first(
            pages,
            lambda page: _first_value(
                _after_label(block, field.match)
                for block in blocks.get(page, ())
            ),
        )
    else:
        pattern = re.compile(field.match)
        text = _first(
            pages,
            lambda page: _first_value(
                _capture(pattern, block) for block in blocks.get(page, ())
            ),
        )
    return TRANSFORMS[field.transform](text)


def _first(
    pages: Sequence[int], find: Callable[[int], str | None]
) -> str | None:
    """Returns what find gives for the first page that has it."""
    for page in pages:
        found = find(page)
        if found is not None:
            return found
    return None


def _first_value(values: Iterable[str | None]) -> str | None:
    """Returns the first value that is not None."""
    return next((value for value in values if value is not None), None)


def _capture(pattern: re.Pattern[str], text: str) -> str | None:
    """Returns the pattern's first group, or the whole match if it has none."""
    found = pattern.search(text)
    if found is None:
        return None
    return found.group(1) if found.groups() else found.group(0)


def _after_label(text: str, label: str) -> str | None:
    """Returns a label's value, when it is on the label's line."""
    index = text.find(label)
    if index < 0:
        return None
    remainder = text[index + len(label) :].split("\n", 1)[0].strip()
    return remainder or None


def _cell_value(tables: Sequence[Table], label: str) -> str | None:
    """Returns the value beside a row label, in any of a page's tables.

    The label may run over more than one row, so every cell that is part of it
    is found first, and the value is the first cell to the right of the
    label's widest column, on a row the label is on.
    """
    for table in tables:
        rows = [
            [" ".join((cell or "").split()) for cell in row] for row in table
        ]
        wanted = " ".join(label.split()).rstrip(":").lower()
        found = [
            (number, column)
            for number, row in enumerate(rows)
            for column, cell in enumerate(row)
            if len(cell) >= 3 and cell.rstrip(":").lower() in wanted
        ]
        if not found:
            continue
        label_rows = sorted({number for number, _ in found})
        label_column = max(column for _, column in found)
        for number in label_rows:
            row = rows[number]
            for column in range(label_column + 1, len(row)):
                if row[column]:
                    return row[column]
    return None


def _records(
    group: Sequence[Field],
    pages: Sequence[int],
    tables: Mapping[int, Sequence[Table]],
) -> list[Record]:
    """Returns the records a group describes, in reading order.

    A table's rows are read in order. A row whose cells number the group's
    fields is a record; a row of one cell is a marker (a dimension heading,
    say) kept for the records that follow it, until another marker replaces
    it. Every pattern a field gives must match a row for it to be a record,
    which is how header rows are passed over.

    A record whose text runs over a page break is printed again at the top of
    the next page, with only the cells that carry on from it filled. Such a
    row has nothing in the column that starts a record, so it is read as the
    continuation of the record above it rather than as a record of its own.
    """
    ordered = [field for field in group if field.index is not None]
    carried = next((field for field in group if field.index is None), None)
    indexes: list[int] = []
    for field in ordered:
        index = field.index
        if index is not None:
            indexes.append(index)
    size = max(indexes) + 1
    patterns = [re.compile(field.match) for field in group if field.match]
    records: list[Record] = []
    marker: str | None = None
    above: list[str] | None = None
    columns: list[int] = []
    record: Record | None = None
    for page in pages:
        for table in tables.get(page, ()):
            for row in table:
                cells = _cells(row)
                if (
                    _continues(cells)
                    and above is not None
                    and record is not None
                ):
                    _extend(above, cells, columns)
                    record.update(_read(group, above, marker))
                    continue
                above = None
                record = None
                compacted = _compact(row)
                if len(compacted) == 1 and carried is not None:
                    marker = compacted[0]
                    continue
                if len(compacted) != size:
                    continue
                line = "\n".join(compacted)
                if any(not pattern.search(line) for pattern in patterns):
                    continue
                record = _read(group, compacted, marker)
                records.append(record)
                above = compacted
                columns = _columns(cells)
    return records


def _cells(row: Sequence[str | None]) -> list[str]:
    """Returns a table row's cells as text, one per column."""
    return [" ".join((cell or "").split()) for cell in row]


def _continues(cells: Sequence[str]) -> bool:
    """Whether a row carries on the record above it.

    A row that runs over a page break is printed again on the next page with
    only the cells that carry on from it filled, so it has nothing in the
    column that starts a record. A marker row fills its first cell instead.
    """
    return not cells[0] and any(cells[1:])


def _columns(row: Sequence[str]) -> list[int]:
    """Maps each column of a row to the value that row holds in it.

    A row printed with merged cells repeats a value across them or leaves
    them empty, so the values a row holds are numbered in the order it fills
    them. A column that holds nothing is numbered by itself, which is what
    the same column holds on a page where the table is printed unmerged.
    """
    filled = [index for index, text in enumerate(row) if text]
    numbers = {index: number for number, index in enumerate(filled)}
    return [numbers.get(index, index) for index in range(len(row))]


def _extend(
    values: list[str], cells: Sequence[str], columns: Sequence[int]
) -> None:
    """Joins a continuation's cells onto the record above, column by column."""
    for index, text in enumerate(cells):
        if not text:
            continue
        column = columns[index] if index < len(columns) else index
        if column < len(values):
            values[column] = f"{values[column]} {text}".strip()


def _read(
    group: Sequence[Field], cells: Sequence[str], marker: str | None
) -> Record:
    """Returns one record's values, read from a row's cells."""
    record: Record = {}
    for field in group:
        index = field.index
        read = marker if index is None else cells[index]
        record[field.key] = TRANSFORMS[field.transform](read)
    return record


def _compact(row: Sequence[str | None]) -> list[str]:
    """Returns a table row's cells, less the empty ones.

    A merged cell's value is repeated across the columns it covers, so a cell
    equal to the one before it is left out too. This makes a row's shape the
    same whichever columns the report merged.
    """
    kept: list[str] = []
    for cell in row:
        text = " ".join((cell or "").split())
        if not text or (kept and kept[-1] == text):
            continue
        kept.append(text)
    return kept
