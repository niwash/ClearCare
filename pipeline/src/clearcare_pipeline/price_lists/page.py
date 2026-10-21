"""Finding the two price lists on the HSE Fair Deal page."""

import urllib.parse
from html.parser import HTMLParser

PRICE_LISTS_PAGE = (
    "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/about/"
)

# HSE gives a list a new file name each time it republishes it, so a list is
# known by how its link starts, lowercased. The page links other PDFs too: the
# application form and the data protection code.
_LINK_TEXTS = {
    "private": "nursing homes support scheme maximum agreed prices",
    "public": "public nursing homes",
}


class PriceListsPageError(Exception):
    """The page does not link each price list exactly once."""


def find_price_lists(html: str, base: str) -> dict[str, str]:
    """Returns the absolute URL of each list's PDF, by home type.

    Raises:
        PriceListsPageError: If a list has no link, or more than one.
    """
    parser = _PdfLinks()
    parser.feed(html)
    parser.close()
    found: dict[str, str] = {}
    for home_type, start in _LINK_TEXTS.items():
        hrefs = [href for href, text in parser.links if text.startswith(start)]
        if len(hrefs) != 1:
            raise PriceListsPageError(
                f"expected one link to the {home_type} list, found {len(hrefs)}"
            )
        found[home_type] = urllib.parse.urljoin(base, hrefs[0])
    return found


class _PdfLinks(HTMLParser):
    """Collects each link to a PDF, with its text lowercased and collapsed."""

    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        if tag != "a":
            return
        href = dict(attrs).get("href") or ""
        self._href = href if href.lower().endswith(".pdf") else None
        self._text = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._href is not None:
            text = " ".join("".join(self._text).split()).lower()
            self.links.append((self._href, text))
            self._href = None

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)
