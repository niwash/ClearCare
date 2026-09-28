import json
from dataclasses import fields
from pathlib import Path

from clearcare_pipeline.snapshots.manifest import append_records
from clearcare_pipeline.snapshots.snapshot import SnapshotRecord


def _record(source: str, error: str | None = None) -> SnapshotRecord:
    succeeded = error is None
    return SnapshotRecord(
        source=source,
        url=f"https://example.test/{source}",
        fetched_at="2026-09-28T06:00:00+00:00",
        attempts=1,
        http_status=200 if succeeded else 503,
        content_type="text/csv",
        size=3 if succeeded else None,
        sha256="ab" * 32 if succeeded else None,
        last_modified=None,
        etag=None,
        error=error,
    )


def test_records_are_appended_as_json_lines(tmp_path: Path) -> None:
    path = tmp_path / "manifests" / "register-snapshots.jsonl"

    append_records(path, [_record("a")])
    append_records(path, [_record("b", error="HTTP 503")])

    lines = [json.loads(line) for line in path.read_text().splitlines()]
    assert [line["source"] for line in lines] == ["a", "b"]
    assert lines[1]["error"] == "HTTP 503"


def test_every_field_is_written(tmp_path: Path) -> None:
    path = tmp_path / "manifest.jsonl"

    append_records(path, [_record("a")])

    written = json.loads(path.read_text())
    assert set(written) == {field.name for field in fields(SnapshotRecord)}
