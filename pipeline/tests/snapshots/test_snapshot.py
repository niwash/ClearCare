import hashlib
from pathlib import Path

import pytest

from clearcare_pipeline.raw_store import FileSystemRawStore
from clearcare_pipeline.snapshots.fetch import FetchError, FetchResult
from clearcare_pipeline.snapshots.snapshot import take_snapshot
from clearcare_pipeline.snapshots.sources import (
    OLDER_PERSONS_REGISTER,
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


def test_valid_register_is_stored_and_described(tmp_path: Path) -> None:
    store = FileSystemRawStore(tmp_path)
    fetcher = FakeFetcher(
        {OLDER_PERSONS_REGISTER.url: [ok(REGISTER_CSV, CSV_TYPE)]}
    )

    record = take_snapshot(OLDER_PERSONS_REGISTER, fetcher, store, fixed_now)

    digest = hashlib.sha256(REGISTER_CSV).hexdigest()
    assert record.ok
    assert record.source == "older_persons_register"
    assert record.url == OLDER_PERSONS_REGISTER.url
    assert record.fetched_at == "2026-09-28T06:00:00+00:00"
    assert record.attempts == 1
    assert record.http_status == 200
    assert record.content_type == CSV_TYPE
    assert record.size == len(REGISTER_CSV)
    assert record.sha256 == digest
    assert record.last_modified == "Mon, 28 Sep 2026 06:00:00 GMT"
    assert record.etag == '"1"'
    assert record.error is None
    assert store.path_for(digest).read_bytes() == REGISTER_CSV


def test_valid_section_64_register_is_stored(tmp_path: Path) -> None:
    store = FileSystemRawStore(tmp_path)
    fetcher = FakeFetcher(
        {SECTION_64_REGISTER.url: [ok(SECTION_64_XLSX, XLSX_TYPE)]}
    )

    record = take_snapshot(SECTION_64_REGISTER, fetcher, store, fixed_now)

    assert record.ok
    assert record.sha256 == hashlib.sha256(SECTION_64_XLSX).hexdigest()


@pytest.mark.parametrize(
    ("result", "expected_error"),
    [
        (failed(503), "HTTP 503"),
        (
            FetchResult(200, CSV_TYPE, b"", None, None),
            "empty body",
        ),
        (
            FetchResult(
                200, "text/html; charset=utf-8", b"<html/>", None, None
            ),
            "unexpected content type text/html",
        ),
        (
            FetchResult(
                200, CSV_TYPE, b"<html>not a register</html>", None, None
            ),
            "unexpected file signature",
        ),
    ],
)
def test_invalid_response_is_recorded_and_not_stored(
    tmp_path: Path, result: FetchResult, expected_error: str
) -> None:
    store = FileSystemRawStore(tmp_path)
    fetcher = FakeFetcher({OLDER_PERSONS_REGISTER.url: [result]})

    record = take_snapshot(OLDER_PERSONS_REGISTER, fetcher, store, fixed_now)

    assert not record.ok
    assert record.error == expected_error
    assert record.http_status == result.status
    assert record.sha256 is None
    assert not (tmp_path / "sha256").exists()


def test_network_failure_is_recorded(tmp_path: Path) -> None:
    store = FileSystemRawStore(tmp_path)
    fetcher = FakeFetcher(
        {OLDER_PERSONS_REGISTER.url: [FetchError("timed out")]}
    )

    record = take_snapshot(OLDER_PERSONS_REGISTER, fetcher, store, fixed_now)

    assert not record.ok
    assert record.error == "fetch failed: timed out"
    assert record.http_status is None
    assert record.sha256 is None
