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


def test_every_stored_copy_of_a_list_is_taken_older_first(
    tmp_path: Path,
) -> None:
    _manifest(
        tmp_path,
        _record("contract-price-private", "https://hse.test/q1.pdf", "a" * 64),
        _record("contract-price-public", "https://hse.test/p1.pdf", "b" * 64),
        _record("contract-price-private", "https://hse.test/q2.pdf", "c" * 64),
    )
    raw = FileSystemRawStore(tmp_path / "raw")

    assert stored_price_lists(tmp_path) == [
        PriceListFile(
            "private", "https://hse.test/q1.pdf", raw.path_for("a" * 64)
        ),
        PriceListFile(
            "public", "https://hse.test/p1.pdf", raw.path_for("b" * 64)
        ),
        PriceListFile(
            "private", "https://hse.test/q2.pdf", raw.path_for("c" * 64)
        ),
    ]


def test_the_same_bytes_downloaded_twice_are_taken_once(
    tmp_path: Path,
) -> None:
    _manifest(
        tmp_path,
        _record("contract-price-public", "https://hse.test/p1.pdf", "a" * 64),
        _record("contract-price-public", "https://hse.test/p2.pdf", "a" * 64),
    )
    raw = FileSystemRawStore(tmp_path / "raw")

    assert stored_price_lists(tmp_path) == [
        PriceListFile(
            "public", "https://hse.test/p1.pdf", raw.path_for("a" * 64)
        ),
    ]


def test_a_failed_download_is_left_out(tmp_path: Path) -> None:
    _manifest(
        tmp_path,
        _record("contract-price-public", "https://hse.test/p1.pdf", "a" * 64),
        _record("contract-price-public", "https://hse.test/p2.pdf", None),
    )
    raw = FileSystemRawStore(tmp_path / "raw")

    assert stored_price_lists(tmp_path) == [
        PriceListFile(
            "public", "https://hse.test/p1.pdf", raw.path_for("a" * 64)
        ),
    ]


def test_a_download_of_another_source_is_left_out(tmp_path: Path) -> None:
    _manifest(
        tmp_path,
        _record("register", "https://hiqa.test/register.csv", "a" * 64),
    )

    assert stored_price_lists(tmp_path) == []


def test_no_manifest_means_no_stored_lists(tmp_path: Path) -> None:
    assert stored_price_lists(tmp_path) == []


def test_a_line_that_is_not_a_record_is_refused(tmp_path: Path) -> None:
    _manifest(tmp_path, '{"source": "contract-price-public"}')

    with pytest.raises(StoredPriceListsError, match="line 1"):
        stored_price_lists(tmp_path)
