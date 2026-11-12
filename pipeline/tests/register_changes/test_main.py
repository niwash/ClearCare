# The stage's walk over the stored register snapshots, on files in a
# temporary data directory. What it writes is in test_database.py.

import logging
from pathlib import Path

import pytest

from clearcare_pipeline.exit_codes import EXIT_FAILED
from clearcare_pipeline.raw_store import FileSystemRawStore
from clearcare_pipeline.register_changes.__main__ import main, stored_changes
from clearcare_pipeline.register_changes.differ import RegisterChange
from clearcare_pipeline.reports.register import register_downloads
from clearcare_pipeline.snapshots.manifest import MANIFEST_NAME
from tests.load_register.fakes import ELM_HALL, centre, store_snapshot

MONDAY = "2026-10-05T06:12:54+00:00"
TUESDAY = "2026-10-06T06:03:11+00:00"
WEDNESDAY = "2026-10-07T06:08:40+00:00"
RENAMED = centre("34", Centre_Title="Elm Hall Care Centre")


def _changes(data_dir: Path) -> list[RegisterChange]:
    downloads = register_downloads(data_dir / "manifests" / MANIFEST_NAME)
    return stored_changes(data_dir, downloads)


def _found(changes: list[RegisterChange]) -> list[tuple[str, str, str]]:
    return [
        (change.shown_on.isoformat(), change.centre_id, change.kind)
        for change in changes
    ]


def test_each_snapshot_is_compared_with_the_ones_before_it(
    tmp_path: Path,
) -> None:
    store_snapshot(tmp_path, MONDAY, ELM_HALL)
    tuesday = store_snapshot(tmp_path, TUESDAY, RENAMED, centre("35"))
    store_snapshot(
        tmp_path,
        WEDNESDAY,
        {**RENAMED, "Maximum_Occupancy": "58"},
        centre("35"),
    )

    changes = _changes(tmp_path)

    assert _found(changes) == [
        ("2026-10-05", "34", "registration"),
        ("2026-10-06", "34", "name"),
        ("2026-10-06", "35", "registration"),
        ("2026-10-07", "34", "beds"),
    ]
    assert changes[1].snapshot_sha256 == tuesday


def test_a_centre_back_after_a_snapshot_without_it_keeps_its_last_entry(
    tmp_path: Path,
) -> None:
    store_snapshot(tmp_path, MONDAY, ELM_HALL, centre("35"))
    store_snapshot(tmp_path, TUESDAY, centre("35"))
    store_snapshot(tmp_path, WEDNESDAY, RENAMED, centre("35"))

    assert _found(_changes(tmp_path)) == [
        ("2026-10-05", "34", "registration"),
        ("2026-10-05", "35", "registration"),
        # Compared with Monday's entry: renamed, and not registered again.
        ("2026-10-07", "34", "name"),
    ]


def test_the_same_file_fetched_on_a_later_day_has_no_changes(
    tmp_path: Path,
) -> None:
    store_snapshot(tmp_path, MONDAY, ELM_HALL)
    store_snapshot(tmp_path, TUESDAY, ELM_HALL)

    assert _found(_changes(tmp_path)) == [("2026-10-05", "34", "registration")]


def test_a_stored_copy_that_cannot_be_read_is_passed_over(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    store_snapshot(tmp_path, MONDAY, ELM_HALL)
    unreadable = store_snapshot(
        tmp_path, TUESDAY, centre("34", Registration_Date="2024-03-14")
    )
    missing = store_snapshot(tmp_path, WEDNESDAY, centre("35"))
    FileSystemRawStore(tmp_path / "raw").path_for(missing).unlink()
    store_snapshot(tmp_path, "2026-10-08T06:01:02+00:00", RENAMED)

    with caplog.at_level(logging.WARNING):
        changes = _changes(tmp_path)

    assert _found(changes) == [
        ("2026-10-05", "34", "registration"),
        ("2026-10-08", "34", "name"),
    ]
    warnings = [record.getMessage() for record in caplog.records]
    assert len(warnings) == 2
    assert f"register snapshot {unreadable} passed over" in warnings[0]
    assert "column Registration_Date" in warnings[0]
    assert f"register snapshot {missing} passed over" in warnings[1]


def test_a_stored_copy_that_does_not_match_its_hash_is_passed_over(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    sha256 = store_snapshot(tmp_path, MONDAY, ELM_HALL)
    stored = FileSystemRawStore(tmp_path / "raw").path_for(sha256)
    stored.chmod(0o644)
    stored.write_bytes(stored.read_bytes() + b"\n")

    assert _changes(tmp_path) == []
    assert "does not match its hash" in caplog.text


def test_broken_manifest_line_fails_the_run(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    manifests = tmp_path / "manifests"
    manifests.mkdir()
    (manifests / MANIFEST_NAME).write_text('{"centre_id": "34"}\n')

    # Refused before any connection: the test has no database to reach.
    code = main(["--data-dir", str(tmp_path)])

    assert code == EXIT_FAILED
    assert "line 1: not a snapshot record" in caplog.text


def test_missing_manifest_fails_the_run(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    code = main(["--data-dir", str(tmp_path)])

    assert code == EXIT_FAILED
    assert "register-snapshots.jsonl not found" in caplog.text
