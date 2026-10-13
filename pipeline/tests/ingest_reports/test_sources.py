"""Tests for the sources the ingest reads reports from."""

from pathlib import Path

from clearcare_pipeline.ingest_reports.sources import from_paths, from_prefix
from tests.object_store_fakes import FakeObjectStore


def test_files_are_read_in_order(tmp_path: Path) -> None:
    first = tmp_path / "a.pdf"
    first.write_bytes(b"%PDF-a")
    second = tmp_path / "b.pdf"
    second.write_bytes(b"%PDF-b")

    items = list(from_paths([first, second]))

    assert [item.name for item in items] == [str(first), str(second)]
    assert items[0].body == b"%PDF-a"


def test_prefix_yields_pdfs_only() -> None:
    store = FakeObjectStore(
        {
            "raw/sha256/bb/x": b"%PDF-b",
            "raw/sha256/aa/y": b"%PDF-a",
            "raw/sha256/aa/page": b"<!DOCTYPE html>",
            "other/z": b"%PDF-c",
        }
    )

    items = list(from_prefix(store, "raw/"))

    assert [item.name for item in items] == [
        "raw/sha256/aa/y",
        "raw/sha256/bb/x",
    ]
    assert items[0].body == b"%PDF-a"
