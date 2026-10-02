import json
from pathlib import Path

from clearcare_pipeline.raw_store import FileSystemRawStore
from clearcare_pipeline.reports.manifest import (
    MANIFEST_NAME as REPORTS_MANIFEST_NAME,
)
from clearcare_pipeline.reports.manifest import CentreRecord, append_record
from clearcare_pipeline.snapshots.manifest import MANIFEST_NAME, append_records
from clearcare_pipeline.snapshots.snapshot import SnapshotRecord
from clearcare_pipeline.upload import upload_data_dir
from tests.object_store_fakes import FakeObjectStore

MANIFEST_KEY = (
    "manifests/register-snapshots/20260928T060000Z_older_persons_register.json"
)
CENTRE_KEY = "manifests/inspection-reports/20261002T155656Z_34.json"


def _record() -> SnapshotRecord:
    return SnapshotRecord(
        source="older_persons_register",
        url="https://example.test/register.csv",
        fetched_at="2026-09-28T06:00:00+00:00",
        attempts=1,
        http_status=200,
        content_type="text/csv",
        size=3,
        sha256="ab" * 32,
        last_modified=None,
        etag=None,
        error=None,
    )


def _centre_record() -> CentreRecord:
    return CentreRecord(
        centre_id="34",
        url="https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall",
        fetched_at="2026-10-02T15:56:56+00:00",
        page_sha256="cd" * 32,
        reports=(),
        error=None,
    )


def _data_dir(tmp_path: Path, raw: bytes = b"abc") -> tuple[Path, str]:
    digest = FileSystemRawStore(tmp_path / "raw").put(raw)
    append_records(tmp_path / "manifests" / MANIFEST_NAME, [_record()])
    return tmp_path, f"raw/sha256/{digest[:2]}/{digest}"


def test_raw_files_and_manifest_records_are_uploaded(tmp_path: Path) -> None:
    data_dir, raw_key = _data_dir(tmp_path)
    store = FakeObjectStore()

    report = upload_data_dir(data_dir, store)

    assert report.ok
    assert set(report.uploaded) == {raw_key, MANIFEST_KEY}
    assert store.objects[raw_key] == b"abc"
    assert json.loads(store.objects[MANIFEST_KEY]) == json.loads(
        (data_dir / "manifests" / MANIFEST_NAME).read_text()
    )


def test_objects_already_in_the_bucket_are_skipped(tmp_path: Path) -> None:
    data_dir, raw_key = _data_dir(tmp_path)
    store = FakeObjectStore(objects={raw_key: b"abc"})

    report = upload_data_dir(data_dir, store)

    assert report.ok
    assert store.puts == [MANIFEST_KEY]
    assert report.already_present == 1


def test_a_corrupted_local_file_is_reported_not_uploaded(
    tmp_path: Path,
) -> None:
    data_dir, raw_key = _data_dir(tmp_path)
    local = data_dir / raw_key
    local.chmod(0o644)
    local.write_bytes(b"changed on disk")
    store = FakeObjectStore()

    report = upload_data_dir(data_dir, store)

    assert not report.ok
    assert report.failed == (f"{raw_key}: content does not match its hash",)
    assert raw_key not in store.objects


def test_a_failed_upload_is_reported_and_the_rest_continue(
    tmp_path: Path,
) -> None:
    data_dir, raw_key = _data_dir(tmp_path)
    store = FakeObjectStore(failing_keys=frozenset({raw_key}))

    report = upload_data_dir(data_dir, store)

    assert not report.ok
    assert report.failed == (f"{raw_key}: AccessDenied",)
    assert store.puts == [MANIFEST_KEY]


def test_an_unreadable_manifest_line_is_reported(tmp_path: Path) -> None:
    data_dir, _ = _data_dir(tmp_path)
    with (data_dir / "manifests" / MANIFEST_NAME).open("a") as manifest:
        manifest.write("not json\n")
    store = FakeObjectStore()

    report = upload_data_dir(data_dir, store)

    assert report.failed == (f"{MANIFEST_NAME} line 2: not a snapshot record",)
    assert MANIFEST_KEY in store.objects


def test_temporary_files_are_ignored(tmp_path: Path) -> None:
    temp = tmp_path / "raw" / "sha256" / "ab" / ".tmp-123"
    temp.parent.mkdir(parents=True)
    temp.write_bytes(b"partial")
    store = FakeObjectStore()

    report = upload_data_dir(tmp_path, store)

    assert report.ok
    assert store.puts == []


def test_an_empty_data_dir_uploads_nothing(tmp_path: Path) -> None:
    report = upload_data_dir(tmp_path, FakeObjectStore())

    assert report.ok
    assert report.uploaded == ()


def test_inspection_report_records_are_uploaded(tmp_path: Path) -> None:
    manifest = tmp_path / "manifests" / REPORTS_MANIFEST_NAME
    append_record(manifest, _centre_record())
    store = FakeObjectStore()

    report = upload_data_dir(tmp_path, store)

    assert report.ok
    assert report.uploaded == (CENTRE_KEY,)
    assert store.objects[CENTRE_KEY] == manifest.read_bytes().rstrip(b"\n")


def test_inspection_report_records_in_the_bucket_are_skipped(
    tmp_path: Path,
) -> None:
    append_record(
        tmp_path / "manifests" / REPORTS_MANIFEST_NAME, _centre_record()
    )
    store = FakeObjectStore(objects={CENTRE_KEY: b"{}"})

    report = upload_data_dir(tmp_path, store)

    assert report.ok
    assert store.puts == []
    assert report.already_present == 1


def test_an_unreadable_report_manifest_line_is_reported(
    tmp_path: Path,
) -> None:
    manifest = tmp_path / "manifests" / REPORTS_MANIFEST_NAME
    manifest.parent.mkdir()
    manifest.write_text('{"centre_id": "../34"}\n')

    report = upload_data_dir(tmp_path, FakeObjectStore())

    assert report.failed == (
        f"{REPORTS_MANIFEST_NAME} line 1: not a centre record",
    )
