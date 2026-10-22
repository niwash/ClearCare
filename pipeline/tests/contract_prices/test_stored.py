import json
from pathlib import Path

import pytest

from clearcare_pipeline.contract_prices.run import PriceListFile
from clearcare_pipeline.contract_prices.stored import (
    StoredPriceListsError,
    stored_price_lists,
)
from clearcare_pipeline.raw_store import FileSystemRawStore


def _record(source: str, url: str, sha256: str | None) -> str:
    return json.dumps(
        {
            "source": source,
            "url": url,
            "fetched_at": "2026-10-21T06:00:00+00:00",
            "sha256": sha256,
            "error": None if sha256 else "HTTP 404",
        }
    )


def _manifest(data_dir: Path, *lines: str) -> None:
    manifest = data_dir / "manifests" / "price-lists.jsonl"
    manifest.parent.mkdir(parents=True)
    manifest.write_text("".join(line + "\n" for line in lines))


def test_the_newest_stored_copy_of_each_list_is_taken(tmp_path: Path) -> None:
    _manifest(
        tmp_path,
        _record("contract-price-public", "https://hse.test/p1.pdf", "a" * 64),
        _record("contract-price-private", "https://hse.test/q1.pdf", "b" * 64),
        _record("contract-price-public", "https://hse.test/p2.pdf", "c" * 64),
        _record("contract-price-private", "https://hse.test/q2.pdf", None),
    )
    raw = FileSystemRawStore(tmp_path / "raw")

    assert stored_price_lists(tmp_path) == [
        PriceListFile(
            "public", "https://hse.test/p2.pdf", raw.path_for("c" * 64)
        ),
        PriceListFile(
            "private", "https://hse.test/q1.pdf", raw.path_for("b" * 64)
        ),
    ]


def test_no_manifest_means_no_stored_lists(tmp_path: Path) -> None:
    assert stored_price_lists(tmp_path) == []


def test_a_line_that_is_not_a_record_is_refused(tmp_path: Path) -> None:
    _manifest(tmp_path, '{"source": "contract-price-public"}')

    with pytest.raises(StoredPriceListsError, match="line 1"):
        stored_price_lists(tmp_path)
