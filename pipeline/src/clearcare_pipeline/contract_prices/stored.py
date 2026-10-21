"""The newest stored copy of each price list, from the download manifest."""

import json
from pathlib import Path

from clearcare_pipeline.contract_prices.run import SOURCES, PriceListFile
from clearcare_pipeline.price_lists.manifest import MANIFEST_NAME
from clearcare_pipeline.raw_store import FileSystemRawStore


class StoredPriceListsError(Exception):
    """A line of the price lists manifest is not a download record."""


def stored_price_lists(data_dir: Path) -> list[PriceListFile]:
    """Returns the newest successful download of each list in the data dir.

    A list that was never downloaded successfully is left out, so the result
    is empty when nothing has been downloaded yet.

    Raises:
        StoredPriceListsError: If a line of the manifest is not a record.
    """
    manifest = data_dir / "manifests" / MANIFEST_NAME
    lines = (
        manifest.read_text(encoding="utf-8").splitlines()
        if manifest.is_file()
        else []
    )
    home_types = {source: home_type for home_type, source in SOURCES.items()}
    store = FileSystemRawStore(data_dir / "raw")
    newest: dict[str, PriceListFile] = {}
    # The manifest is appended to, so a later line is a newer download.
    for number, line in enumerate(lines, 1):
        try:
            record = json.loads(line)
            home_type = home_types.get(record["source"])
            if (
                home_type is not None
                and record["error"] is None
                and isinstance(record["sha256"], str)
            ):
                newest[home_type] = PriceListFile(
                    home_type, record["url"], store.path_for(record["sha256"])
                )
        except (ValueError, KeyError, TypeError) as problem:
            raise StoredPriceListsError(
                f"{manifest.name} line {number}: not a download record"
            ) from problem
    return [newest[home_type] for home_type in SOURCES if home_type in newest]
