import hashlib
import stat
from pathlib import Path

from clearcare_pipeline.raw_store import FileSystemRawStore


def test_put_returns_sha256_and_stores_content(tmp_path: Path) -> None:
    store = FileSystemRawStore(tmp_path)
    content = b"Centre_ID,Centre_Title\n34,Elm Hall Nursing Home\n"

    key = store.put(content)

    assert key == hashlib.sha256(content).hexdigest()
    assert store.path_for(key).read_bytes() == content


def test_files_are_sharded_by_hash_prefix(tmp_path: Path) -> None:
    store = FileSystemRawStore(tmp_path)

    key = store.put(b"abc")

    assert store.path_for(key) == tmp_path / "sha256" / key[:2] / key


def test_put_is_idempotent(tmp_path: Path) -> None:
    store = FileSystemRawStore(tmp_path)

    first = store.put(b"same bytes")
    second = store.put(b"same bytes")

    assert first == second
    assert store.path_for(first).read_bytes() == b"same bytes"


def test_stored_files_are_read_only(tmp_path: Path) -> None:
    store = FileSystemRawStore(tmp_path)

    mode = store.path_for(store.put(b"x")).stat().st_mode

    assert mode & (stat.S_IWUSR | stat.S_IWGRP | stat.S_IWOTH) == 0
