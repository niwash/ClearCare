"""Reading and writing contract prices in PostgreSQL."""

from typing import Protocol

import psycopg
from psycopg.rows import TupleRow

from clearcare_pipeline.contract_prices.models import (
    ContractPriceList,
    SourceFile,
)

# Held until the transaction ends, so two ingests never write at once. Nothing
# else takes this lock in this database, so any fixed number works.
LOCK_KEY = 76

Connection = psycopg.Connection[TupleRow]

# A file's bytes are only ever stored once; a second download of the same
# bytes is another row for the same hash, so the newest is the one about to be
# written against.
_FIND_SOURCE_FILE = (
    "SELECT source_file_id FROM clearcare.source_file"
    " WHERE sha256 = %s ORDER BY fetched_at DESC LIMIT 1"
)
_INSERT_SOURCE_FILE = (
    "INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)"
    " VALUES (%s, %s, %s, now()) RETURNING source_file_id"
)
# A list already loaded from these bytes is left out, so a repeated run adds
# nothing even if the file was stored again under a new row.
_IS_LOADED = (
    "SELECT 1 FROM clearcare.contract_price_list"
    " JOIN clearcare.source_file USING (source_file_id)"
    " WHERE sha256 = %s LIMIT 1"
)
# The n-th distinct file loaded for a home type and date. Taken under the
# advisory lock, so a version cannot be taken twice.
_NEXT_VERSION = (
    "SELECT coalesce(max(version), 0) + 1 FROM clearcare.contract_price_list"
    " WHERE home_type = %s AND record_date = %s"
)
_INSERT_LIST = (
    "INSERT INTO clearcare.contract_price_list"
    " (home_type, record_date, version, source_file_id)"
    " VALUES (%s, %s, %s, %s) RETURNING id"
)
_INSERT_PRICE = (
    "INSERT INTO clearcare.contract_price (list_id, centre_id, price)"
    " VALUES (%s, %s, %s) ON CONFLICT DO NOTHING"
)


class Catalogue(Protocol):
    """What the database already holds, for the ingest to look prices up in.

    The ingest asks this before it writes anything, so an implementation can
    read it all once rather than answering a query for each list.
    """

    def centre_exists(self, centre_id: str) -> bool:
        """Whether the register has loaded this centre."""
        ...

    def price_list_loaded(self, sha256: str) -> bool:
        """Whether a list has been loaded from a file with this hash."""
        ...


class Writer(Protocol):
    """Where the ingest workflow sends its lists."""

    def write(
        self, prices: ContractPriceList, source_file: SourceFile
    ) -> int | None:
        """Writes one list and its prices.

        Returns how many prices were written, or None when the same bytes
        were already loaded.
        """
        ...


class DatabaseCatalogue:
    """What the database holds, read once when the catalogue is made.

    A run has a few hundred centres and a handful of lists to look up, so it
    holds them rather than asking the database again for each price.
    """

    def __init__(self, connection: Connection) -> None:
        """Reads the loaded centres and the loaded price lists."""
        self._centres: set[str] = {
            str(row[0])
            for row in connection.execute(
                "SELECT centre_id FROM clearcare.centre"
            ).fetchall()
        }
        # By hash, so a list downloaded again is not loaded again.
        self._loaded: set[str] = {
            str(row[0])
            for row in connection.execute(
                "SELECT DISTINCT sha256 FROM clearcare.source_file"
                " JOIN clearcare.contract_price_list USING (source_file_id)"
            ).fetchall()
        }

    def centre_exists(self, centre_id: str) -> bool:
        """Whether the register has loaded this centre."""
        return centre_id in self._centres

    def price_list_loaded(self, sha256: str) -> bool:
        """Whether a list has been loaded from a file with this hash."""
        return sha256 in self._loaded


class PriceListWriter:
    """Writes price lists as clearcare_pipeline, one transaction per list.

    A list already loaded from the same bytes is left out, so a run that is
    repeated adds nothing; a list whose date and home type are already stored
    is written as the next version of that list, and the version before it is
    left exactly as it was.
    """

    def __init__(self, connection: Connection) -> None:
        """Creates a writer on a connection that commits on its own."""
        self._connection = connection

    def write(
        self, prices: ContractPriceList, source_file: SourceFile
    ) -> int | None:
        """Writes the list and its prices in one transaction.

        Returns None when the same bytes were already loaded, and otherwise
        how many prices were written.
        """
        with (
            self._connection.transaction(),
            self._connection.cursor() as cursor,
        ):
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", (LOCK_KEY,))
            if cursor.execute(_IS_LOADED, (source_file.sha256,)).fetchone():
                return None
            list_id = self._list_id(cursor, prices, source_file)
            cursor.executemany(
                _INSERT_PRICE,
                [
                    (list_id, price.centre_id, price.price)
                    for price in prices.prices
                ],
            )
        return len(prices.prices)

    def _list_id(
        self,
        cursor: psycopg.Cursor[TupleRow],
        prices: ContractPriceList,
        source_file: SourceFile,
    ) -> int:
        """Stores the file if it is new, and returns the list's new id."""
        found = cursor.execute(
            _FIND_SOURCE_FILE, (source_file.sha256,)
        ).fetchone()
        if found is None:
            found = cursor.execute(
                _INSERT_SOURCE_FILE,
                (source_file.source, source_file.url, source_file.sha256),
            ).fetchone()
        assert found is not None
        version = cursor.execute(
            _NEXT_VERSION, (prices.home_type, prices.record_date)
        ).fetchone()
        assert version is not None
        written = cursor.execute(
            _INSERT_LIST,
            (
                prices.home_type,
                prices.record_date,
                version[0],
                found[0],
            ),
        ).fetchone()
        # INSERT ... RETURNING gives back the row it inserted.
        assert written is not None
        return int(written[0])
