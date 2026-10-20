"""Extracting key values and record tables from a HIQA report (CCARE-34).

A report's values are described in a CSV, as its sections are (CCARE-35), so a
change to the layout is a change to the file rather than to this module. A
value is read from a table cell, a label in the section's text, or a regular
expression; the rows of a table become a list of records.

A table's rows are read either by ``table_row``, which numbers the values a
row fills (handy when the report merges cells), or by ``table_column``, which
reads each field from its own column so a blank cell doesn't shift the rest.
A column the report writes once for a block of rows, like the county on a
price list, is a ``table_label``; its value is carried down the block.

A table the report prints with no lines between its rows is read by
``block_column``: PyMuPDF returns one table row per block of entries, so the
rows are rebuilt from the text on the page, one row per printed line, and
each line is put in the column it is printed in.

A value the document states once, like the kind of home a price list covers, is
a ``constant``: its value is the row's ``match``, and it is read as a field
rather than repeated on every record.

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

from clearcare_pipeline.parser.text import ReportText

if TYPE_CHECKING:
    from clearcare_pipeline.parser.parser import TextBlock

KINDS: Final = ("field", "record")
SOURCES: Final = (
    "label",
    "regex",
    "table_cell",
    "table_row",
    "table_column",
    "table_label",
    "block_column",
    "constant",
)
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
    text: tuple[ReportText, ...] = ()
    # Each regulation whose response was not stored, and why.
    missing_responses: tuple[tuple[str, str], ...] = ()


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
    if (
        cells["source"]
        in ("table_row", "table_column", "table_label", "block_column")
        and cells["kind"] != "record"
    ):
        raise bad(f"{cells['source']} is only for a record")
    if cells["source"] == "constant" and not cells["match"]:
        raise bad("constant needs its value in match")
    if cells["source"] == "constant" and cells["kind"] != "field":
        raise bad("constant is only for a field")
    if (
        cells["source"] in ("table_column", "table_label")
        and not cells["index"]
    ):
        raise bad(f"{cells['source']} needs a column index")
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
            one marker value, reads no table column at all, or mixes
            table_row and table_column.
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
        if not any(
            field.source in ("table_row", "table_column", "block_column")
            and field.index is not None
            for field in members
        ):
            raise ValueError(f"{name}: group {group} reads no table column")
        table = {
            field.source
            for field in members
            if field.source in ("table_row", "table_column")
        }
        if len(table) > 1:
            raise ValueError(
                f"{name}: group {group} mixes table_row and table_column"
            )
        if table and any(field.source == "block_column" for field in members):
            raise ValueError(
                f"{name}: group {group} mixes block_column with"
                f" {', '.join(sorted(table))}"
            )


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
            group[0].group: _records(
                group, pages[group[0].location], tables, document
            )
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
    if field.source == "constant":
        text = field.match
    elif field.source == "table_cell":
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
    document: pymupdf.Document,
) -> list[Record]:
    """Returns the records a group describes, in reading order.

    A table's rows are read in order. A row whose cells number the group's
    fields is a record; a row of one cell is a marker (a dimension heading,
    say) kept for the records that follow it, until another marker replaces
    it. Every pattern a field gives must match a row for it to be a record,
    which is how header rows are passed over.

    A ``table_label`` field reads a column the report fills once for a block
    and then leaves blank, such as the county on a price list. Its value is
    carried into the rows below, and the column is left out of the record's
    shape.

    A ``table_row`` group numbers the values a row fills, so a report that
    merges cells still lines up on every page. A ``table_column`` group reads
    each field at its own column, so a blank cell doesn't shift the fields
    after it. A ``block_column`` group does the same on a table the report
    prints with no row lines, whose rows are rebuilt from the printed text.

    A record whose text runs over a page break is printed again at the top of
    the next page, with only the cells that carry on from it filled. Such a
    row has nothing in the column that starts a record, so it is read as the
    continuation of the record above it rather than as a record of its own.
    """
    labels = [field for field in group if field.source == "table_label"]
    if any(field.source == "block_column" for field in group):
        return _block_records(group, pages, document)
    columns = [field for field in group if field.source == "table_column"]
    if columns:
        return _column_records(group, labels, columns, pages, tables)
    return _row_records(group, labels, pages, tables)


def _row_records(
    group: Sequence[Field],
    labels: Sequence[Field],
    pages: Sequence[int],
    tables: Mapping[int, Sequence[Table]],
) -> list[Record]:
    """Reads a ``table_row`` group's records, in reading order.

    A report's table merges cells, so its rows are read compacted: the empty
    and repeated cells are left out.
    """
    columns = [field for field in group if field.source == "table_row"]
    rows = (
        row for page in pages for table in tables.get(page, ()) for row in table
    )
    return _read_records(group, labels, columns, rows, compact=True)


def _column_records(
    group: Sequence[Field],
    labels: Sequence[Field],
    columns: Sequence[Field],
    pages: Sequence[int],
    tables: Mapping[int, Sequence[Table]],
) -> list[Record]:
    """Reads a ``table_column`` group's records, in reading order."""
    rows = (
        row for page in pages for table in tables.get(page, ()) for row in table
    )
    return _read_records(group, labels, columns, rows)


def _block_records(
    group: Sequence[Field],
    pages: Sequence[int],
    document: pymupdf.Document,
) -> list[Record]:
    """Reads a ``block_column`` group's records, in reading order.

    The rows come from the text on each page rather than from a table.
    """
    columns = [field for field in group if field.source == "block_column"]
    rows = [row for page in pages for row in _block_rows(document, page)]
    return _read_records(group, (), columns, rows)


def _read_records(
    group: Sequence[Field],
    labels: Sequence[Field],
    columns: Sequence[Field],
    rows: Iterable[Sequence[str | None]],
    *,
    compact: bool = False,
) -> list[Record]:
    """Reads the records of a group whose values each come from a column.

    Each field comes from its own column, so a blank cell stays blank and
    does not shift the fields after it. A ``table_row`` group is read
    compacted instead, because the report merges cells: empty and repeated
    cells are left out, and a row of another width is not a record.
    """
    carried = next((field for field in group if field.index is None), None)
    hidden = sorted(field.index for field in labels if field.index is not None)
    indexes = [
        _adjusted(field.index, hidden)
        for field in columns
        if field.index is not None
    ]
    size = max(indexes) + 1
    first = min(indexes)
    patterns = [re.compile(field.match) for field in group if field.match]
    records: list[Record] = []
    marker: str | None = None
    carried_labels: dict[str, Value] = {field.key: None for field in labels}
    above: list[str] | None = None
    record: Record | None = None
    # How the row above holds its values, for a row that carries on from it.
    widths: Sequence[int] = ()
    for row in rows:
        cells = _cells(row)
        found = {
            field.key: cells[field.index]
            for field in labels
            if field.index is not None
        }
        if hidden:
            cells = _without(cells, hidden)
        if not compact:
            cells = _pad(cells, size)
        if (
            _continues(cells, first)
            and above is not None
            and record is not None
        ):
            _extend(above, cells, widths)
            record.update(_read(group, above, marker, hidden, carried_labels))
            continue
        above = None
        record = None
        if compact:
            line = _compact(cells)
        else:
            if not any(cells):
                continue
            line = cells
        filled = [cell for cell in line if cell]
        if len(filled) == 1 and carried is not None:
            marker = filled[0]
            continue
        if compact and len(line) != size:
            continue
        text = "\n".join(line)
        if any(not pattern.search(text) for pattern in patterns):
            continue
        for key, value in found.items():
            if value:
                carried_labels[key] = value
        record = _read(group, line, marker, hidden, carried_labels)
        records.append(record)
        above = list(line)
        widths = _columns(cells) if compact else range(len(cells))
    return records


def _block_rows(document: pymupdf.Document, page: int) -> list[list[str]]:
    """Returns a page's table rows, rebuilt from the text printed on it.

    A table the report prints with no lines between its rows gives PyMuPDF
    one table row per block of entries, with each cell's values joined by
    newlines and a blank cell left out of the list, so the row cannot be
    split back into entries. The report still prints one text block per row,
    so each block's lines are read and put in the column they are printed in.

    A block of one line is a heading for the entries below it - the county on
    a public price list, say - and is put in the row's first cell, where the
    reader takes it as the block's marker.
    """
    bounds, (top, bottom) = _table_geometry(document, page)
    if not bounds:
        raise ValueError(f"no table on page {page}")
    content = cast("Any", document[page - 1].get_text("dict"))
    rows: list[list[str]] = []
    for block in content["blocks"]:
        area = block["bbox"]
        if not top - 1 <= (area[1] + area[3]) / 2 <= bottom + 1:
            continue
        lines = [
            (
                " ".join(span["text"] for span in line["spans"]).strip(),
                line["bbox"],
            )
            for line in block.get("lines", [])
        ]
        printed = [line for line in lines if line[0]]
        if not printed:
            continue
        row = [""] * len(bounds)
        if len(printed) == 1:
            row[0] = printed[0][0]
            rows.append(row)
            continue
        for text, bbox in printed:
            column = _column(bounds, bbox)
            row[column] = f"{row[column]} {text}".strip()
        rows.append(row)
    return rows


def _table_geometry(
    document: pymupdf.Document, page: int
) -> tuple[list[tuple[float, float]], tuple[float, float]]:
    """Returns where a page's table sits, and where its columns start and end.

    A table printed without row lines still prints a line of column headings
    and, on the page it starts on, its own lines, so PyMuPDF finds the
    columns' extents even where it cannot find the rows.
    """
    finder = cast("Any", document[page - 1].find_tables())
    found = list(finder.tables)
    if not found:
        return [], (0.0, 0.0)
    area = (
        min(table.bbox[1] for table in found),
        max(table.bbox[3] for table in found),
    )
    bounds: list[tuple[float, float]] = []
    for table in found:
        for row in table.rows:
            cells = [cell for cell in row.cells if cell is not None]
            if len(cells) > len(bounds):
                bounds = [(cell[0], cell[2]) for cell in cells]
    return bounds, area


def _column(bounds: Sequence[tuple[float, float]], box: Sequence[float]) -> int:
    """Returns the column a line printed at box falls in."""
    centre = (box[0] + box[2]) / 2
    for index, (start, end) in enumerate(bounds):
        if start - 2 <= centre <= end + 2:
            return index
    return min(
        range(len(bounds)),
        key=lambda index: abs(bounds[index][0] - box[0]),
    )


def _without(cells: Sequence[str], hidden: Sequence[int]) -> list[str]:
    """Returns a row's cells with the given columns left out."""
    return [cell for index, cell in enumerate(cells) if index not in hidden]


def _pad(cells: list[str], size: int) -> list[str]:
    """Pads a row with empty cells out to the table's width."""
    return cells + [""] * (size - len(cells)) if len(cells) < size else cells


def _cells(row: Sequence[str | None]) -> list[str]:
    """Returns a table row's cells as text, one per column."""
    return [" ".join((cell or "").split()) for cell in row]


def _continues(cells: Sequence[str], first: int) -> bool:
    """Whether a row carries on the record above it.

    A row that runs over a page break is printed again on the next page with
    only the cells that carry on from it filled, so it has nothing in the
    column that starts a record. A marker row fills its first cell instead.
    """
    if first >= len(cells):
        return False
    return not cells[first] and any(
        cell for index, cell in enumerate(cells) if index != first
    )


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


def _adjusted(index: int, hidden: Sequence[int]) -> int:
    """Returns a column's position once the hidden columns are left out."""
    return index - sum(1 for column in hidden if column < index)


def _read(
    group: Sequence[Field],
    cells: Sequence[str],
    marker: str | None,
    hidden: Sequence[int],
    labels: Mapping[str, Value],
) -> Record:
    """Returns one record's values, read from a row's cells.

    A ``table_label`` value comes from the block it was written above, not
    from the row itself.
    """
    record: Record = {}
    for field in group:
        index = field.index
        read: Value
        if field.source == "table_label":
            read = labels.get(field.key)
        elif index is None:
            read = marker
        else:
            read = cells[_adjusted(index, hidden)]
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
