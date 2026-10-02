"""Reading the list of inspection reports from a HIQA centre page."""

import re
import urllib.parse
from dataclasses import dataclass
from datetime import datetime
from html.parser import HTMLParser

# The page links each report through /system/files?file=..., and HIQA puts
# that route, like its report list pages, behind a browser verification. The
# direct path below is not verified. We only download from the direct path
# and never try to get past the verification.
DIRECT_REPORT_URL = "https://www.hiqa.ie/system/files/inspectionreports/"

# The report list is the Drupal view block with this class. A centre with no
# published report has the block with nothing inside (seen on centre 9439).
_REPORT_LIST = "view-display-id-centre_ir_block"
_REPORT_FILE = re.compile(r"inspectionreports/([^/\\]+\.pdf)", re.IGNORECASE)
_INSPECTION_DATE = "view-field-ir-inspection-start-date-table-column"
_REPORT_TYPE = "view-field-ir-report-type-table-column"
_PUBLISHED_DATE = "view-field-ir-published-date-table-column"
_DOWNLOAD = "view-field-ir-publication-files-table-column"
_COLUMNS = (_INSPECTION_DATE, _REPORT_TYPE, _PUBLISHED_DATE, _DOWNLOAD)


@dataclass(frozen=True)
class Report:
    """An inspection report listed on a centre page, and our copy of its PDF.

    The centre page gives the first five fields. The download fills in the
    rest, which stay None until it does.

    Attributes:
        inspection_date: First day of the inspection, as YYYY-MM-DD.
        report_type: HIQA's "Report type" column, such as "Nursing Homes".
            It names the kind of centre, not the inspection kind.
        published_date: Day HIQA published the report, as YYYY-MM-DD.
        file_name: Name of the report's PDF on HIQA's site.
        url: Where the PDF can be downloaded without browser verification.
        sha256: Hash of the stored PDF.
        size: Size of the stored PDF in bytes.
        fetched_at: When the stored PDF was downloaded, in UTC.
        error: Why the PDF is not stored.
    """

    inspection_date: str
    report_type: str
    published_date: str
    file_name: str
    url: str
    sha256: str | None = None
    size: int | None = None
    fetched_at: str | None = None
    error: str | None = None


@dataclass(frozen=True)
class CentrePage:
    """What a centre page says about the centre's inspection reports."""

    centre_id: str
    reports: tuple[Report, ...]


class CentrePageError(Exception):
    """The page is not a centre page we know how to read."""


def parse_centre_page(html: str) -> CentrePage:
    """Returns the centre ID and every report in the page's report list.

    Raises:
        CentrePageError: If the page has no centre ID, has no report list or
            only part of one, or a report row cannot be read.
    """
    parser = _CentrePageParser()
    parser.feed(html)
    parser.close()
    if not parser.centre_id:
        raise CentrePageError("no centre ID on the page")
    if not parser.list_found:
        raise CentrePageError("no report list on the page")
    if not parser.list_closed or (
        parser.table_found and not parser.table_closed
    ):
        raise CentrePageError("the report list is cut off")
    if parser.has_pager:
        raise CentrePageError("the report list has more than one page")
    if not parser.table_found:
        if parser.list_has_content:
            raise CentrePageError("the report list has no report table")
        return CentrePage(centre_id=parser.centre_id, reports=())
    if sorted(parser.columns) != sorted(_COLUMNS):
        raise CentrePageError(
            f"unexpected columns in the report table: {parser.columns}"
        )
    return CentrePage(
        centre_id=parser.centre_id,
        reports=tuple(_report(row) for row in parser.rows),
    )


def _report(row: dict[str, str]) -> Report:
    for column, name in (
        (_INSPECTION_DATE, "inspection date"),
        (_REPORT_TYPE, "report type"),
        (_PUBLISHED_DATE, "published date"),
        (_DOWNLOAD, "download link"),
    ):
        if not row.get(column):
            raise CentrePageError(f"a report row has no {name}")
    file_name = _file_name(row[_DOWNLOAD])
    return Report(
        inspection_date=_date(row[_INSPECTION_DATE], "inspection date"),
        report_type=row[_REPORT_TYPE],
        published_date=_date(row[_PUBLISHED_DATE], "published date"),
        file_name=file_name,
        url=DIRECT_REPORT_URL + urllib.parse.quote(file_name),
    )


def _date(value: str, name: str) -> str:
    # HIQA marks each date as noon UTC on the day, e.g. 2026-04-10T12:00:00Z,
    # so the UTC date is the date shown on the page.
    try:
        return datetime.fromisoformat(value).date().isoformat()
    except ValueError as error:
        raise CentrePageError(
            f"a report row has an unreadable {name} {value!r}"
        ) from error


def _file_name(href: str) -> str:
    link = urllib.parse.urlsplit(href)
    files = urllib.parse.parse_qs(link.query).get("file", [])
    match = _REPORT_FILE.fullmatch(files[0]) if len(files) == 1 else None
    if (
        link.netloc not in ("", "www.hiqa.ie")
        or link.path != "/system/files"
        or match is None
        or match.group(1).startswith(".")
    ):
        raise CentrePageError(f"unexpected download link {href!r}")
    return match.group(1)


class _CentrePageParser(HTMLParser):
    """Collects the centre ID and the report list's table, and nothing else.

    Tables and pagers elsewhere on the page are ignored.
    """

    def __init__(self) -> None:
        super().__init__()
        self.centre_id = ""
        self.list_found = False
        self.list_closed = False
        self.list_has_content = False
        self.table_found = False
        self.table_closed = False
        self.has_pager = False
        self.columns: list[str] = []
        self.rows: list[dict[str, str]] = []
        self._list_depth = 0
        self._in_centre_id_field = False
        self._reading_centre_id = False
        self._row: dict[str, str] | None = None
        self._column: str | None = None

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        attributes = {name: value or "" for name, value in attrs}
        classes = attributes.get("class", "").split()
        if self._list_depth:
            self._start_in_list(tag, attributes, classes)
        elif tag == "div" and _REPORT_LIST in classes:
            self.list_found = True
            self._list_depth = 1
        elif tag == "div" and "views-field-field-centre-id" in classes:
            self._in_centre_id_field = True
        elif tag == "div" and self._in_centre_id_field:
            self._reading_centre_id = "field-content" in classes

    def _start_in_list(
        self, tag: str, attributes: dict[str, str], classes: list[str]
    ) -> None:
        self.list_has_content = True
        if tag == "div":
            self._list_depth += 1
        if "pager" in classes:
            self.has_pager = True
        if tag == "table":
            self.table_found = True
        elif tag == "th":
            self.columns.append(attributes.get("id", ""))
        elif tag == "tr":
            self._row = {}
        elif tag == "td" and self._row is not None:
            self._column = attributes.get("headers")
        elif tag == "time" and self._row is not None and self._column:
            self._row[self._column] = attributes.get("datetime", "")
        elif tag == "a" and self._row is not None and self._column:
            self._row[self._column] = attributes.get("href", "")

    def handle_endtag(self, tag: str) -> None:
        if self._list_depth:
            self._end_in_list(tag)
        elif tag == "div" and self._reading_centre_id:
            self._reading_centre_id = False
            self._in_centre_id_field = False

    def _end_in_list(self, tag: str) -> None:
        if tag == "div":
            self._list_depth -= 1
            self.list_closed = self._list_depth == 0
        elif tag == "table":
            self.table_closed = True
        elif tag == "td":
            self._column = None
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None

    def handle_data(self, data: str) -> None:
        if self._reading_centre_id:
            self.centre_id += data.strip()
        elif self._row is not None and self._column == _REPORT_TYPE:
            text = data.strip()
            if text:
                self._row[_REPORT_TYPE] = text
