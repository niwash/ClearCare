"""Test doubles for the contract price ingest."""

from collections.abc import Collection

from clearcare_pipeline.contract_prices.models import (
    ContractPriceList,
    SourceFile,
)


class FakeCatalogue:
    """What the database holds, for a test to state.

    known_centres is the set of centre ids the register holds; None means
    every centre is found. loaded_files is the set of hashes already loaded.
    """

    def __init__(
        self,
        known_centres: set[str] | None = None,
        loaded_files: Collection[str] = (),
    ) -> None:
        self._known_centres = known_centres
        self._loaded_files = loaded_files

    def centre_exists(self, centre_id: str) -> bool:
        return self._known_centres is None or centre_id in self._known_centres

    def price_list_loaded(self, sha256: str) -> bool:
        return sha256 in self._loaded_files


class FakeWriter:
    """A writer that keeps the lists it was given in memory.

    loaded says the list's bytes are already stored, so the writer reports
    that it wrote nothing.
    """

    def __init__(self, loaded: bool = False) -> None:
        self.lists: list[tuple[ContractPriceList, SourceFile]] = []
        self._loaded = loaded

    def write(
        self, prices: ContractPriceList, source_file: SourceFile
    ) -> int | None:
        self.lists.append((prices, source_file))
        return None if self._loaded else len(prices.prices)
