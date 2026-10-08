import json
from pathlib import Path

import pytest

from clearcare_pipeline.load_register.__main__ import main
from clearcare_pipeline.raw_store import FileSystemRawStore
from tests.load_register.fakes import ELM_HALL, register_csv


def test_file_that_does_not_match_its_hash_is_refused(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.setenv("CLEARCARE_PIPELINE_VERSION", "test")
    sha256 = "0" * 64
    stored = FileSystemRawStore(tmp_path / "raw").path_for(sha256)
    stored.parent.mkdir(parents=True)
    stored.write_bytes(register_csv(ELM_HALL))
    manifests = tmp_path / "manifests"
    manifests.mkdir()
    line = {
        "source": "older_persons_register",
        "url": "https://www.hiqa.ie/register.csv",
        "fetched_at": "2026-10-05T06:12:54+00:00",
        "sha256": sha256,
        "last_modified": None,
        "error": None,
    }
    (manifests / "register-snapshots.jsonl").write_text(json.dumps(line) + "\n")

    # Refused before any connection: the test has no database to reach.
    code = main(["--data-dir", str(tmp_path)])

    assert code == 1
    assert "does not match its hash" in caplog.text
