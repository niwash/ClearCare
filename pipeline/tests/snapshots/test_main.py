import hashlib
from pathlib import Path

from clearcare_pipeline.snapshots.__main__ import main
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
    no_sleep,
    ok,
)


def test_main_writes_raw_files_and_manifest_under_data_dir(
    tmp_path: Path,
) -> None:
    fetcher = FakeFetcher(
        {
            OLDER_PERSONS_REGISTER.url: [ok(REGISTER_CSV, CSV_TYPE)],
            SECTION_64_REGISTER.url: [ok(SECTION_64_XLSX, XLSX_TYPE)],
        }
    )

    code = main(["--data-dir", str(tmp_path)], fetcher=fetcher, sleep=no_sleep)

    digest = hashlib.sha256(REGISTER_CSV).hexdigest()
    manifest = tmp_path / "manifests" / "register-snapshots.jsonl"
    assert code == 0
    assert len(manifest.read_text().splitlines()) == 2
    assert (tmp_path / "raw" / "sha256" / digest[:2] / digest).exists()


def test_main_returns_failure_when_a_source_fails(tmp_path: Path) -> None:
    fetcher = FakeFetcher(
        {
            OLDER_PERSONS_REGISTER.url: [failed(503)] * 3,
            SECTION_64_REGISTER.url: [ok(SECTION_64_XLSX, XLSX_TYPE)],
        }
    )

    code = main(["--data-dir", str(tmp_path)], fetcher=fetcher, sleep=no_sleep)

    assert code == 1
