"""Tests for the sources the ingest reads reports from."""

from pathlib import Path

from clearcare_pipeline.ingest_reports.sources import (
    from_data_dir,
    from_paths,
    from_prefix,
)
from clearcare_pipeline.raw_store import FileSystemRawStore
from tests.ingest_reports.fakes import write_reports_manifest
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


def test_data_dir_yields_each_stored_report_file_once(tmp_path: Path) -> None:
    store = FileSystemRawStore(tmp_path / "raw")
    first = store.put(b"%PDF-a")
    second = store.put(b"%PDF-b")
    write_reports_manifest(
        tmp_path,
        {
            "a.pdf": first,
            "a-again.pdf": first,
            "b.pdf": second,
            "not-downloaded.pdf": None,
        },
    )

    items = list(from_data_dir(tmp_path))

    assert [item.body for item in items] == [b"%PDF-a", b"%PDF-b"]
