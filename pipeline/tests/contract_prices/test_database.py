"""Database tests for the contract price writer and catalogue. Needs Docker."""

from dataclasses import replace
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from psycopg import errors

from clearcare_pipeline.contract_prices.__main__ import main
from clearcare_pipeline.contract_prices.database import (
    DatabaseCatalogue,
    PriceListWriter,
)
from clearcare_pipeline.contract_prices.models import (
    ContractPrice,
    ContractPriceList,
    SourceFile,
)
from tests.database import PASSWORDS, PIPELINE, migrated_database

PUBLIC_PDF = (
    Path(__file__).resolve().parents[2]
    / "src"
    / "clearcare_pipeline"
    / "max_contract_price_public.pdf"
)

PUBLIC_FILE = SourceFile("hse_nhss", "https://example.test/one", "a" * 64)
SECOND_FILE = SourceFile("hse_nhss", "https://example.test/two", "b" * 64)
PRICE_LIST = ContractPriceList(
    home_type="public",
    record_date=date(2026, 9, 1),
    prices=(
        ContractPrice("549", Decimal("1908")),
        ContractPrice("550", Decimal("2134")),
    ),
)
CENTRES = "INSERT INTO clearcare.centre (centre_id) VALUES ('549'), ('550')"


@pytest.mark.database
def test_a_list_is_written_once() -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        # main() connects with autocommit, so each list commits on its own.
        connection.autocommit = True
        connection.execute(CENTRES)
        catalogue = DatabaseCatalogue(connection)
        writer = PriceListWriter(connection)

        assert not catalogue.price_list_loaded(PUBLIC_FILE.sha256)
        assert writer.write(PRICE_LIST, PUBLIC_FILE) == 2
        # The same bytes again add nothing, and neither does a catalogue that
        # has seen them.
        assert writer.write(PRICE_LIST, PUBLIC_FILE) is None
        assert DatabaseCatalogue(connection).price_list_loaded(
            PUBLIC_FILE.sha256
        )

        counts = connection.execute(
            "SELECT"
            " (SELECT count(*) FROM clearcare.contract_price_list),"
            " (SELECT count(*) FROM clearcare.contract_price),"
            " (SELECT count(*) FROM clearcare.source_file)"
        ).fetchone()
        assert counts == (1, 2, 1)

        rows = connection.execute(
            "SELECT centre_id, price FROM clearcare.contract_price"
            " ORDER BY centre_id"
        ).fetchall()
        assert rows == [
            ("549", Decimal("1908.00")),
            ("550", Decimal("2134.00")),
        ]


@pytest.mark.database
def test_a_reissued_list_is_a_new_version() -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        connection.execute(CENTRES)
        writer = PriceListWriter(connection)

        assert writer.write(PRICE_LIST, PUBLIC_FILE) == 2
        corrected = replace(
            PRICE_LIST,
            prices=(ContractPrice("549", Decimal("2000")),),
        )
        assert writer.write(corrected, SECOND_FILE) == 1

        rows = connection.execute(
            "SELECT l.version, f.sha256, p.centre_id, p.price"
            " FROM clearcare.contract_price p"
            " JOIN clearcare.contract_price_list l ON l.id = p.list_id"
            " JOIN clearcare.source_file f"
            " ON f.source_file_id = l.source_file_id"
            " ORDER BY l.version, p.centre_id"
        ).fetchall()
        # The first version is left exactly as it was loaded.
        assert rows == [
            (1, "a" * 64, "549", Decimal("1908.00")),
            (1, "a" * 64, "550", Decimal("2134.00")),
            (2, "b" * 64, "549", Decimal("2000.00")),
        ]


@pytest.mark.database
def test_a_later_date_is_another_list() -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        connection.execute(CENTRES)
        writer = PriceListWriter(connection)

        writer.write(PRICE_LIST, PUBLIC_FILE)
        later = replace(PRICE_LIST, record_date=date(2027, 1, 1))
        assert writer.write(later, SECOND_FILE) == 2

        rows = connection.execute(
            "SELECT record_date, version FROM clearcare.contract_price_list"
            " ORDER BY record_date"
        ).fetchall()
        assert rows == [(date(2026, 9, 1), 1), (date(2027, 1, 1), 1)]


@pytest.mark.database
def test_a_price_for_an_unknown_centre_is_refused() -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        writer = PriceListWriter(connection)

        with pytest.raises(errors.ForeignKeyViolation):
            writer.write(PRICE_LIST, PUBLIC_FILE)

        counts = connection.execute(
            "SELECT count(*) FROM clearcare.contract_price"
        ).fetchone()
        assert counts == (0,)


@pytest.mark.database
@pytest.mark.skipif(
    not PUBLIC_PDF.is_file(),
    reason="the public contract price list is not committed",
)
def test_the_command_line_loads_the_public_list(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The whole path: the option, the parser, the catalogue, the rows."""
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        connection.execute(
            "INSERT INTO clearcare.centre (centre_id) VALUES ('549'), ('485')"
        )
        monkeypatch.setenv("PGHOST", database.host)
        monkeypatch.setenv("PGPORT", str(database.port))
        monkeypatch.setenv("PGDATABASE", "clearcare")
        monkeypatch.setenv("PGUSER", PIPELINE)
        monkeypatch.setenv("PGPASSWORD", PASSWORDS[PIPELINE])

        exit_code = main(
            ["--public", str(PUBLIC_PDF), "https://example.test/public"]
        )
        # Loading the same file again changes nothing.
        again = main(
            ["--public", str(PUBLIC_PDF), "https://example.test/public"]
        )
        counts = connection.execute(
            "SELECT"
            " (SELECT count(*) FROM clearcare.contract_price_list),"
            " (SELECT count(*) FROM clearcare.contract_price)"
        ).fetchone()

    assert exit_code == 0
    assert again == 0
    # The list holds 115 prices; the register has the two centres seeded here.
    assert counts == (1, 2)
