"""The rows a parsed contract price list becomes.

These mirror the tables in db/V8__contract_prices.sql, and the source_file row
the list's PDF is stored as. A list does not carry its source_file_id: the
file is stored in the same transaction, so the id exists only once it has
been written.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True)
class SourceFile:
    """A price list PDF, as it enters the raw store."""

    source: str
    url: str
    sha256: str


@dataclass(frozen=True)
class ContractPrice:
    """One centre's price in one list."""

    centre_id: str
    price: Decimal


@dataclass(frozen=True)
class ContractPriceList:
    """One loaded list: its home type, its date, and the prices it holds."""

    home_type: str
    record_date: date
    prices: tuple[ContractPrice, ...]
