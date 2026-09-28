import json
from pathlib import Path
from typing import Any

from clearcare_pipeline.raw_store import FileSystemRawStore
from clearcare_pipeline.snapshots.fetch import FetchError
from clearcare_pipeline.snapshots.run import run
from clearcare_pipeline.snapshots.sources import (
    OLDER_PERSONS_REGISTER,
    REGISTER_SOURCES,
    SECTION_64_REGISTER,
)
from tests.snapshots.fakes import (
    CSV_TYPE,
    REGISTER_CSV,
    SECTION_64_XLSX,
    XLSX_TYPE,
    FakeFetcher,
    failed,
    fixed_now,
    ok,
)

WAITS = (60.0, 300.0)


def _read(manifest: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in manifest.read_text().splitlines()]


def test_all_sources_succeed(tmp_path: Path) -> None:
    manifest = tmp_path / "manifest.jsonl"
    fetcher = FakeFetcher(
        {
            OLDER_PERSONS_REGISTER.url: [ok(REGISTER_CSV, CSV_TYPE)],
            SECTION_64_REGISTER.url: [ok(SECTION_64_XLSX, XLSX_TYPE)],
        }
    )
    sleeps: list[float] = []

    code = run(
        REGISTER_SOURCES,
        fetcher,
        FileSystemRawStore(tmp_path / "raw"),
        manifest,
        fixed_now,
        sleeps.append,
        WAITS,
    )

    records = _read(manifest)
    assert code == 0
    assert [r["source"] for r in records] == [
        "older_persons_register",
        "section_64_register",
    ]
    assert all(r["error"] is None and r["attempts"] == 1 for r in records)
    assert sleeps == []


def test_failed_attempt_is_retried_after_waiting(tmp_path: Path) -> None:
    manifest = tmp_path / "manifest.jsonl"
    fetcher = FakeFetcher(
        {
            OLDER_PERSONS_REGISTER.url: [
                FetchError("connection reset"),
                ok(REGISTER_CSV, CSV_TYPE),
            ],
            SECTION_64_REGISTER.url: [ok(SECTION_64_XLSX, XLSX_TYPE)],
        }
    )
    sleeps: list[float] = []

    code = run(
        REGISTER_SOURCES,
        fetcher,
        FileSystemRawStore(tmp_path / "raw"),
        manifest,
        fixed_now,
        sleeps.append,
        WAITS,
    )

    first = _read(manifest)[0]
    assert code == 0
    assert sleeps == [60.0]
    assert first["attempts"] == 2
    assert first["error"] is None


def test_source_failing_every_attempt_fails_the_run(tmp_path: Path) -> None:
    manifest = tmp_path / "manifest.jsonl"
    fetcher = FakeFetcher(
        {
            OLDER_PERSONS_REGISTER.url: [failed(503)] * 3,
            SECTION_64_REGISTER.url: [ok(SECTION_64_XLSX, XLSX_TYPE)],
        }
    )
    sleeps: list[float] = []

    code = run(
        REGISTER_SOURCES,
        fetcher,
        FileSystemRawStore(tmp_path / "raw"),
        manifest,
        fixed_now,
        sleeps.append,
        WAITS,
    )

    records = _read(manifest)
    assert code == 1
    assert sleeps == [60.0, 300.0]
    assert records[0]["attempts"] == 3
    assert records[0]["error"] == "HTTP 503"
    assert records[1]["error"] is None
