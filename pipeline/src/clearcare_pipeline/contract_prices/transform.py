"""Turning a parsed price list into the rows the database stores.

This is the business logic between the parser and the database: which date the
list belongs to, what kind of home it covers, and each price as a number of
euro. The parser reads values as the document writes them ("1st September
2026", "€1,220", "1,908"); this module decides what the database needs.
"""

import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Final

from clearcare_pipeline.contract_prices.models import (
    ContractPrice,
    ContractPriceList,
)
from clearcare_pipeline.parser.fields import Record, Value
from clearcare_pipeline.parser.fields import Report as ParsedReport

GROUP: Final = "contract_prices"
HOME_TYPES: Final = ("public", "private")
# The date key each list prints: the public list's "Effective from", the
# private list's "Date Modified". Either may be read from either format.
DATE_KEYS: Final = ("effective_date", "date_modified")
# "1st September 2026" and "4/9/2026".
ORDINAL: Final = re.compile(r"(\d+)(st|nd|rd|th)")
DATE_FORMATS: Final = ("%d %B %Y", "%d/%m/%Y")
# "€1,220" on the private list, "1,908" on the public one.
PRICE: Final = re.compile(r"^€?\s*(\d[\d,]*)$")


class TransformError(Exception):
    """A parsed price list lacks something the database requires."""


@dataclass(frozen=True)
class SkippedPrice:
    """A price the list prints but the database cannot store."""

    centre_id: str
    reason: str


def to_contract_price_list(
    parsed: ParsedReport,
) -> tuple[ContractPriceList, tuple[SkippedPrice, ...]]:
    """Turns the parser's output into the rows the database stores.

    A price that is not printed as a number of euro is left out and returned
    with the reason, rather than failing the whole list.

    Raises:
        TransformError: If the list does not say which kind of home it covers,
            or which date its prices belong to.
    """
    prices: list[ContractPrice] = []
    skipped: list[SkippedPrice] = []
    for row in parsed.records.get(GROUP, ()):
        price = _price(row.get("contract_price"))
        if price is None:
            skipped.append(
                SkippedPrice(
                    _text(row.get("centre_id")) or "",
                    f"not a euro amount: {row.get('contract_price')!r}",
                )
            )
            continue
        prices.append(ContractPrice(centre_id=_centre_id(row), price=price))
    return (
        ContractPriceList(
            home_type=_home_type(parsed),
            record_date=_record_date(parsed),
            prices=tuple(prices),
        ),
        tuple(skipped),
    )


def _text(value: Value) -> str | None:
    """Returns a value as trimmed text, or None when it is empty."""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _centre_id(row: Record) -> str:
    """Returns the record's centre id.

    Raises:
        TransformError: If the record has none.
    """
    centre_id = _text(row.get("centre_id"))
    if centre_id is None:
        raise TransformError("a record has no centre id")
    return centre_id


def _home_type(parsed: ParsedReport) -> str:
    """Returns the kind of home the list covers.

    Raises:
        TransformError: If the list does not say, or says something else.
    """
    home_type = _text(parsed.fields.get("home_type"))
    if home_type not in HOME_TYPES:
        raise TransformError(f"the list names no home type: {home_type!r}")
    return home_type


def _record_date(parsed: ParsedReport) -> date:
    """Returns the date the list's prices belong to.

    Raises:
        TransformError: If the list prints no date, or one that is not read.
    """
    for key in DATE_KEYS:
        text = _text(parsed.fields.get(key))
        if text is None:
            continue
        for fmt in DATE_FORMATS:
            try:
                return datetime.strptime(_without_ordinal(text), fmt).date()
            except ValueError:
                continue
        raise TransformError(f"{key} is not a date: {text!r}")
    raise TransformError("the list has no effective or modified date")


def _without_ordinal(text: str) -> str:
    """Returns "1st September 2026" as "1 September 2026"."""
    return ORDINAL.sub(r"\1", text)


def _price(value: Value) -> Decimal | None:
    """Returns a printed price in euro, or None when it is not one."""
    text = _text(value)
    if text is None:
        return None
    match = PRICE.match(text)
    if match is None:
        return None
    price = Decimal(match.group(1).replace(",", ""))
    return price if price > 0 else None
