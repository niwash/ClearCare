"""Tests for the ingest run: what it writes, what it leaves out, what fails."""

import hashlib
from datetime import date
from decimal import Decimal
from pathlib import Path

from clearcare_pipeline.contract_prices.models import (
    ContractPrice,
    ContractPriceList,
)
from clearcare_pipeline.contract_prices.run import PriceListFile, ingest
from clearcare_pipeline.contract_prices.transform import TransformError
from clearcare_pipeline.parser.fields import Report
from tests.contract_prices.fakes import FakeCatalogue, FakeWriter

PUBLIC = PriceListFile(
    home_type="public",
    url="https://example.test/public",
    path=Path("public.pdf"),
)
PRIVATE = PriceListFile(
    home_type="private",
    url="https://example.test/private",
    path=Path("private.pdf"),
)


def _parsed(home_type: str, date_text: str, *prices: tuple[str, str]) -> Report:
    key = "effective_date" if home_type == "public" else "date_modified"
    return Report(
        fields={"home_type": home_type, key: date_text},
        records={
            "contract_prices": [
                {"centre_id": centre_id, "contract_price": price}
                for centre_id, price in prices
            ]
        },
    )


def _parse(body: bytes, home_type: str) -> Report:
    """A parse that reads the bytes as the home type they name."""
    if body == b"public":
        return _parsed("public", "1st September 2026", ("549", "1,908"))
    return _parsed("private", "4/9/2026", ("199", "€1,220"))


def test_each_list_is_written_once(tmp_path: Path) -> None:
    public = tmp_path / "public.pdf"
    public.write_bytes(b"public")
    writer = FakeWriter()

    summary = ingest(
        [PriceListFile("public", PUBLIC.url, public)],
        FakeCatalogue(),
        writer,
        parse=_parse,
    )

    assert summary.parsed == 1
    assert summary.written == 1
    assert summary.prices == 1
    written, source_file = writer.lists[0]
    assert written.home_type == "public"
    assert written.record_date == date(2026, 9, 1)
    assert written.prices == (ContractPrice("549", Decimal("1908")),)
    assert source_file.source == "contract-price-public"
    assert source_file.url == "https://example.test/public"
    assert len(source_file.sha256) == 64


def test_a_list_already_loaded_is_not_parsed_again(tmp_path: Path) -> None:
    public = tmp_path / "public.pdf"
    public.write_bytes(b"public")
    digest = hashlib.sha256(b"public").hexdigest()
    writer = FakeWriter()

    summary = ingest(
        [PriceListFile("public", PUBLIC.url, public)],
        FakeCatalogue(loaded_files=[digest]),
        writer,
        parse=lambda body, home_type: (_ for _ in ()).throw(
            AssertionError("parsed a loaded list")
        ),
    )

    assert summary.already_loaded == 1
    assert writer.lists == []


def test_a_price_for_an_unknown_centre_is_skipped(tmp_path: Path) -> None:
    private = tmp_path / "private.pdf"
    private.write_bytes(b"private")
    writer = FakeWriter()

    summary = ingest(
        [PriceListFile("private", PRIVATE.url, private)],
        FakeCatalogue(known_centres=set()),
        writer,
        parse=_parse,
    )

    assert summary.skipped == 1
    assert summary.written == 1
    assert writer.lists[0][0].prices == ()


def test_a_list_named_as_the_other_home_type_fails(tmp_path: Path) -> None:
    private = tmp_path / "private.pdf"
    private.write_bytes(b"public")

    summary = ingest(
        [PriceListFile("private", PRIVATE.url, private)],
        FakeCatalogue(),
        FakeWriter(),
        parse=_parse,
    )

    assert summary.failed == 1
    assert summary.written == 0


def test_an_unreadable_file_fails(tmp_path: Path) -> None:
    summary = ingest(
        [PriceListFile("public", PUBLIC.url, tmp_path / "missing.pdf")],
        FakeCatalogue(),
        FakeWriter(),
        parse=_parse,
    )

    assert summary.failed == 1


def test_a_list_the_transform_rejects_fails(tmp_path: Path) -> None:
    public = tmp_path / "public.pdf"
    public.write_bytes(b"public")

    def reject(body: bytes, home_type: str) -> Report:
        raise TransformError("not a price list")

    summary = ingest(
        [PriceListFile("public", PUBLIC.url, public)],
        FakeCatalogue(),
        FakeWriter(),
        parse=reject,
    )

    assert summary.failed == 1


def test_a_list_the_writer_skips_is_counted_as_loaded(tmp_path: Path) -> None:
    public = tmp_path / "public.pdf"
    public.write_bytes(b"public")

    summary = ingest(
        [PriceListFile("public", PUBLIC.url, public)],
        FakeCatalogue(),
        FakeWriter(loaded=True),
        parse=_parse,
    )

    assert summary.already_loaded == 1
    assert summary.written == 0


def test_a_written_list_keeps_its_prices(tmp_path: Path) -> None:
    public = tmp_path / "public.pdf"
    public.write_bytes(b"public")
    writer = FakeWriter()

    ingest(
        [PriceListFile("public", PUBLIC.url, public)],
        FakeCatalogue(),
        writer,
        parse=_parse,
    )

    written: ContractPriceList = writer.lists[0][0]
    assert len(written.prices) == 1
