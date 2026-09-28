from pathlib import Path

from clearcare_pipeline.raw_store import FileSystemRawStore
from clearcare_pipeline.upload.__main__ import main
from tests.object_store_fakes import FakeObjectStore


def test_main_uploads_the_data_dir(tmp_path: Path) -> None:
    digest = FileSystemRawStore(tmp_path / "raw").put(b"abc")
    store = FakeObjectStore()

    code = main(["--data-dir", str(tmp_path)], env={}, store=store)

    assert code == 0
    assert store.puts == [f"raw/sha256/{digest[:2]}/{digest}"]


def test_main_fails_when_an_upload_fails(tmp_path: Path) -> None:
    digest = FileSystemRawStore(tmp_path / "raw").put(b"abc")
    store = FakeObjectStore(
        failing_keys=frozenset({f"raw/sha256/{digest[:2]}/{digest}"})
    )

    code = main(["--data-dir", str(tmp_path)], env={}, store=store)

    assert code == 1


def test_main_reports_missing_settings(tmp_path: Path) -> None:
    code = main(["--data-dir", str(tmp_path)], env={})

    assert code == 2
