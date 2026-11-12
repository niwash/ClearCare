"""Every stored copy of the price lists, from the download manifest."""

import json
from pathlib import Path

from clearcare_pipeline.contract_prices.run import SOURCES, PriceListFile
from clearcare_pipeline.price_lists.manifest import MANIFEST_NAME
from clearcare_pipeline.raw_store import FileSystemRawStore


class StoredPriceListsError(Exception):
    """A line of the price lists manifest is not a download record."""


def stored_price_lists(data_dir: Path) -> list[PriceListFile]:
    """Returns every successful download in the data dir, oldest first.

    A file downloaded more than once is returned once, as it was first
    downloaded. The result is empty when nothing has been downloaded yet.

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
    # Keyed by hash: most weeks HSE has not changed a list, so the same file
    # is downloaded again.
    files: dict[str, PriceListFile] = {}
    # The manifest is appended to, so its order is the order of download. The
    # lists are loaded in that order, so a database built from the bucket
    # gives a re-issued list the same version as one that loaded it on the
    # day (ADR-0018).
    for number, line in enumerate(lines, 1):
        try:
            record = json.loads(line)
            home_type = home_types.get(record["source"])
            if (
                home_type is not None
                and record["error"] is None
                and isinstance(record["sha256"], str)
            ):
                files.setdefault(
                    record["sha256"],
                    PriceListFile(
                        home_type,
                        record["url"],
                        store.path_for(record["sha256"]),
                    ),
                )
        except (ValueError, KeyError, TypeError) as problem:
            raise StoredPriceListsError(
                f"{manifest.name} line {number}: not a download record"
            ) from problem
    return list(files.values())
