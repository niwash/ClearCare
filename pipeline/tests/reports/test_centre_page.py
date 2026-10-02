from pathlib import Path

import pytest

from clearcare_pipeline.reports.centre_page import (
    CentrePageError,
    Report,
    parse_centre_page,
)

CENTRE_34 = (Path(__file__).parent / "fixtures" / "centre-34.html").read_text(
    encoding="utf-8"
)
HEADER = """
    <thead><tr>
      <th id="view-field-ir-inspection-start-date-table-column">Date</th>
      <th id="view-field-ir-report-type-table-column">Report type</th>
      <th id="view-field-ir-published-date-table-column">Published</th>
      <th id="view-field-ir-publication-files-table-column">Download</th>
    </tr></thead>
"""


def _page(report_list: str) -> str:
    return f"""
    <div class="views-field views-field-field-centre-id">
      <span class="views-label">Centre ID: </span>
      <div class="field-content">34</div>
    </div>
    {report_list}
    """


def _report_list(content: str) -> str:
    return f"""
    <div class="reports view view-display-id-centre_ir_block">
      {content}
    </div>
    """


def _table(rows: str) -> str:
    return _report_list(
        f'<div class="view-content"><table>{HEADER}'
        f"<tbody>{rows}</tbody></table></div>"
    )


def _row(
    href: str = "/system/files?file=inspectionreports/34-report.pdf",
    inspected: str = "2026-04-10T12:00:00Z",
) -> str:
    return f"""
    <tr>
      <td headers="view-field-ir-inspection-start-date-table-column">
        <time datetime="{inspected}">10 Apr 2026</time></td>
      <td headers="view-field-ir-report-type-table-column">Nursing Homes</td>
      <td headers="view-field-ir-published-date-table-column">
        <time datetime="2026-08-27T12:00:00Z">27 Aug 2026</time></td>
      <td headers="view-field-ir-publication-files-table-column">
        <a href="{href}">Download</a></td>
    </tr>
    """


def test_reads_centre_id_and_every_listed_report() -> None:
    page = parse_centre_page(CENTRE_34)

    assert page.centre_id == "34"
    assert [
        (report.inspection_date, report.published_date, report.file_name)
        for report in page.reports
    ] == [
        (
            "2026-04-10",
            "2026-08-27",
            "34-elm-hall-nursing-home-10-april-2026.pdf",
        ),
        (
            "2025-06-25",
            "2025-09-25",
            "34-elm-hall-nursing-home-25-june-2025.pdf",
        ),
        (
            "2024-08-29",
            "2024-11-05",
            "34-elm-hall-nursing-home-29-august-2024.pdf",
        ),
        (
            "2024-03-05",
            "2024-05-23",
            "34-elm-hall-nursing-home-05-march-2024.pdf",
        ),
    ]


def test_listed_report_has_its_direct_url_and_no_download_yet() -> None:
    report = parse_centre_page(CENTRE_34).reports[0]

    assert report == Report(
        inspection_date="2026-04-10",
        report_type="Nursing Homes",
        published_date="2026-08-27",
        file_name="34-elm-hall-nursing-home-10-april-2026.pdf",
        url="https://www.hiqa.ie/system/files/inspectionreports/"
        "34-elm-hall-nursing-home-10-april-2026.pdf",
    )
    assert report.sha256 is None
    assert report.fetched_at is None


def test_empty_report_list_means_no_reports() -> None:
    # How HIQA renders a centre with no published report (centre 9439).
    page = parse_centre_page(_page(_report_list("")))

    assert page.reports == ()


def test_page_without_centre_id_is_rejected() -> None:
    with pytest.raises(CentrePageError, match="no centre ID"):
        parse_centre_page("<html><body>Browser Verification</body></html>")


def test_page_without_report_list_is_rejected() -> None:
    with pytest.raises(CentrePageError, match="no report list"):
        parse_centre_page(_page("<table><tr><td>x</td></tr></table>"))


def test_report_list_cut_off_is_rejected() -> None:
    cut_off = _page(_table(_row()))[:-60]

    with pytest.raises(CentrePageError, match="cut off"):
        parse_centre_page(cut_off)


def test_report_list_content_without_table_is_rejected() -> None:
    content = '<div class="view-content"><p>Reports moved</p></div>'

    with pytest.raises(CentrePageError, match="no report table"):
        parse_centre_page(_page(_report_list(content)))


def test_report_table_with_other_columns_is_rejected() -> None:
    table = _table(_row()).replace("view-field-ir-report-type", "view-other")

    with pytest.raises(CentrePageError, match="unexpected columns"):
        parse_centre_page(_page(table))


def test_pager_in_the_report_list_is_rejected() -> None:
    paged = _table(_row()).replace(
        "</table>", '</table><nav class="pager"></nav>'
    )

    with pytest.raises(CentrePageError, match="more than one page"):
        parse_centre_page(_page(paged))


@pytest.mark.parametrize(
    "href",
    [
        "/system/files?file=other/34-report.pdf",
        "/system/files?file=inspectionreports/../secrets.pdf",
        "/system/files?file=inspectionreports/34-report.docx",
        "https://example.com/34-report.pdf",
    ],
)
def test_unexpected_download_link_is_rejected(href: str) -> None:
    with pytest.raises(CentrePageError, match="unexpected download link"):
        parse_centre_page(_page(_table(_row(href=href))))


def test_date_that_is_not_a_date_is_rejected() -> None:
    with pytest.raises(CentrePageError, match="inspection date"):
        parse_centre_page(_page(_table(_row(inspected="2026-13-45T12:00"))))


def test_row_with_missing_cells_is_rejected() -> None:
    row = """
    <tr>
      <td headers="view-field-ir-report-type-table-column">Nursing Homes</td>
      <td headers="view-field-ir-publication-files-table-column">
        <a href="/system/files?file=inspectionreports/a.pdf">Download</a></td>
    </tr>
    """

    with pytest.raises(CentrePageError, match="inspection date"):
        parse_centre_page(_page(_table(row)))
