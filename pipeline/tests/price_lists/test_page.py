from pathlib import Path

import pytest

from clearcare_pipeline.price_lists.page import (
    PRICE_LISTS_PAGE,
    PriceListsPageError,
    find_price_lists,
)

# A cut-down copy of the page as HSE served it on 21 October 2026.
PAGE = (Path(__file__).parent / "fixtures" / "fair-deal-about.html").read_text(
    encoding="utf-8"
)


def test_each_list_is_found_by_its_link_text() -> None:
    assert find_price_lists(PAGE, PRICE_LISTS_PAGE) == {
        "private": "https://www2.hse.ie/documents/3223/"
        "HSE_Section40_List_230_Published_List_04.09.2026.pdf",
        "public": "https://www2.hse.ie/documents/7322/"
        "NHSS_Cost_of_Care_September_2026_Update.pdf",
    }


def test_a_page_without_the_public_list_is_refused() -> None:
    page = PAGE.replace("Public nursing homes", "Older persons services")

    with pytest.raises(PriceListsPageError, match="public"):
        find_price_lists(page, PRICE_LISTS_PAGE)


def test_a_list_linked_twice_is_refused() -> None:
    second = (
        '<a href="/documents/1/Republished.pdf">'
        "Nursing homes support scheme maximum agreed prices (PDF)</a>"
    )
    page = PAGE.replace("</main>", f"{second}</main>")

    with pytest.raises(PriceListsPageError, match="private"):
        find_price_lists(page, PRICE_LISTS_PAGE)
