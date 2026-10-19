"""Tests for the transform between a parsed price list and its rows."""

from datetime import date
from decimal import Decimal

import pytest

from clearcare_pipeline.contract_prices.transform import (
    TransformError,
    to_contract_price_list,
)
from clearcare_pipeline.parser.fields import Record, Report, Value


def _parsed(
    fields: dict[str, Value],
    *records: Record,
) -> Report:
    return Report(fields=fields, records={"contract_prices": list(records)})


def _record(centre_id: str, price: str) -> Record:
    return {"centre_id": centre_id, "contract_price": price}


def test_a_public_effective_date_is_read() -> None:
    parsed = _parsed(
        {"home_type": "public", "effective_date": "1st September 2026"},
        _record("549", "1,908"),
    )

    prices, skipped = to_contract_price_list(parsed)

    assert prices.record_date == date(2026, 9, 1)
    assert prices.home_type == "public"
    assert skipped == ()


def test_a_private_modified_date_is_read() -> None:
    parsed = _parsed(
        {"home_type": "private", "date_modified": "4/9/2026"},
        _record("199", "€1,220"),
    )

    prices, _ = to_contract_price_list(parsed)

    # DD/MM/YYYY, as HIQA and the HSE print their dates.
    assert prices.record_date == date(2026, 9, 4)


def test_a_price_is_read_with_or_without_a_currency_sign() -> None:
    parsed = _parsed(
        {"home_type": "public", "effective_date": "1st September 2026"},
        _record("549", "1,908"),
        _record("550", "€2,134"),
    )

    prices, _ = to_contract_price_list(parsed)

    assert [(row.centre_id, row.price) for row in prices.prices] == [
        ("549", Decimal("1908")),
        ("550", Decimal("2134")),
    ]


def test_a_price_that_is_not_an_amount_is_skipped() -> None:
    parsed = _parsed(
        {"home_type": "public", "effective_date": "1st September 2026"},
        _record("549", "1,908"),
        _record("550", "TBC"),
    )

    prices, skipped = to_contract_price_list(parsed)

    assert [row.centre_id for row in prices.prices] == ["549"]
    assert [(row.centre_id, row.reason) for row in skipped] == [
        ("550", "not a euro amount: 'TBC'")
    ]


def test_a_zero_price_is_skipped() -> None:
    parsed = _parsed(
        {"home_type": "public", "effective_date": "1st September 2026"},
        _record("549", "0"),
    )

    prices, skipped = to_contract_price_list(parsed)

    assert prices.prices == ()
    assert len(skipped) == 1


def test_a_list_without_a_home_type_is_rejected() -> None:
    parsed = _parsed({"effective_date": "1st September 2026"})

    with pytest.raises(TransformError, match="home type"):
        to_contract_price_list(parsed)


def test_a_list_without_a_date_is_rejected() -> None:
    parsed = _parsed({"home_type": "public"})

    with pytest.raises(TransformError, match="no effective or modified date"):
        to_contract_price_list(parsed)


def test_an_unreadable_date_is_rejected() -> None:
    parsed = _parsed({"home_type": "private", "date_modified": "last Tuesday"})

    with pytest.raises(TransformError, match="date_modified is not a date"):
        to_contract_price_list(parsed)


def test_a_record_without_a_centre_id_is_rejected() -> None:
    parsed = _parsed(
        {"home_type": "public", "effective_date": "1st September 2026"},
        {"contract_price": "1,908"},
    )

    with pytest.raises(TransformError, match="no centre id"):
        to_contract_price_list(parsed)
