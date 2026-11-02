import json
from pathlib import Path

import pytest

from clearcare_pipeline.raw_store import FileSystemRawStore
from clearcare_pipeline.schedule.bucket_state import (
    BucketStateError,
    restore,
    save,
)
from tests.object_store_fakes import FakeObjectStore

EMPTY_CHECKPOINT = b'{"version": 1, "schedule": {}, "manifests": {}}'
STATE = {
    "register": {
        "scope": "all",
        "last_success": "2026-10-14T06:00:00+00:00",
        "next_attempt": "2026-10-15T06:00:00+00:00",
        "last_outcome": "succeeded",
    }
}


def test_a_saved_data_directory_is_restored_exactly(tmp_path: Path) -> None:
    source = tmp_path / "source"
    (source / "manifests").mkdir(parents=True)
    # Out of order and without a final newline: the text is kept as it is.
    (source / "manifests" / "register-snapshots.jsonl").write_text(
        '{"fetched_at": "2026-10-14"}\n{"fetched_at": "2026-10-01"}'
    )
    (source / "manifests" / "price-lists.jsonl").write_text('{"n": 1}\n')
    (source / "schedule-state.json").write_text(json.dumps(STATE))
    digest = FileSystemRawStore(source / "raw").put(b"%PDF-1.7 report")
    raw_file = f"raw/sha256/{digest[:2]}/{digest}"
    store = FakeObjectStore({raw_file: b"%PDF-1.7 report"})

    save(store, source, source / "schedule-state.json")
    target = tmp_path / "target"
    restore(store, target, target / "schedule-state.json")

    for name in (
        "manifests/register-snapshots.jsonl",
        "manifests/price-lists.jsonl",
        raw_file,
    ):
        assert (target / name).read_bytes() == (source / name).read_bytes()
    assert not (target / "manifests" / "inspection-reports.jsonl").exists()
    assert json.loads((target / "schedule-state.json").read_text()) == STATE


def test_a_raw_file_that_does_not_match_its_key_stops_the_restore(
    tmp_path: Path,
) -> None:
    key = "raw/sha256/ab/ab" + "0" * 62
    store = FakeObjectStore(
        {
            "state/pipeline.json": EMPTY_CHECKPOINT,
            key: b"other bytes",
        }
    )

    with pytest.raises(BucketStateError, match=key):
        restore(store, tmp_path, tmp_path / "schedule-state.json")
