import json
from pathlib import Path

import pytest

from clearcare_pipeline.raw_store import FileSystemRawStore
from clearcare_pipeline.reports.__main__ import main
from tests.reports.fakes import html, pdf
from tests.snapshots.fakes import FakeFetcher, no_sleep

PAGE = (Path(__file__).parent / "fixtures" / "centre-34.html").read_bytes()
ELM_HALL = (
    "https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall-nursing-home"
)
OTHER = "https://www.hiqa.ie/areas-we-work/find-a-centre/other-nursing-home"
REPORTS = "https://www.hiqa.ie/system/files/inspectionreports/34-elm-hall-"
REGISTER = (
    "Centre_ID,Centre_Title,County,URL\n"
    f"34,Elm Hall Nursing Home,Kildare,{ELM_HALL}\n"
    f"35,Other Nursing Home,Kildare,{OTHER}\n"
    "1,Aclare House Nursing Home,Dublin,https://www.hiqa.ie/aclare\n"
).encode()


def _data_dir(tmp_path: Path) -> Path:
    sha256 = FileSystemRawStore(tmp_path / "raw").put(REGISTER)
    manifests = tmp_path / "manifests"
    manifests.mkdir()
    line = {"source": "older_persons_register", "sha256": sha256, "error": None}
    (manifests / "register-snapshots.jsonl").write_text(json.dumps(line) + "\n")
    return tmp_path


def _elm_hall_fetcher() -> FakeFetcher:
    return FakeFetcher(
        {
            ELM_HALL: [html(PAGE)],
            REPORTS + "nursing-home-10-april-2026.pdf": [pdf(b"%PDF a")],
            REPORTS + "nursing-home-25-june-2025.pdf": [pdf(b"%PDF b")],
            REPORTS + "nursing-home-29-august-2024.pdf": [pdf(b"%PDF c")],
            REPORTS + "nursing-home-05-march-2024.pdf": [pdf(b"%PDF d")],
        }
    )


def test_limit_downloads_the_first_centres_of_the_county(
    tmp_path: Path,
) -> None:
    data_dir = _data_dir(tmp_path)
    fetcher = _elm_hall_fetcher()

    code = main(
        ["--data-dir", str(data_dir), "--county", "Kildare", "--limit", "1"],
        fetcher=fetcher,
        sleep=no_sleep,
    )

    manifest = data_dir / "manifests" / "inspection-reports.jsonl"
    assert code == 0
    assert OTHER not in fetcher.calls
    assert len(manifest.read_text().splitlines()) == 1


def test_failed_download_fails_the_run(tmp_path: Path) -> None:
    fetcher = FakeFetcher({ELM_HALL: [html(b"<html>Busy</html>")] * 3})

    code = main(
        ["--data-dir", str(_data_dir(tmp_path)), "--county", "Kildare"],
        fetcher=fetcher,
        sleep=no_sleep,
    )

    assert code == 1


def test_county_without_centres_fails(tmp_path: Path) -> None:
    code = main(
        ["--data-dir", str(_data_dir(tmp_path)), "--county", "Atlantis"],
        fetcher=FakeFetcher({}),
        sleep=no_sleep,
    )

    assert code == 1


def test_missing_register_snapshot_fails(tmp_path: Path) -> None:
    code = main(
        ["--data-dir", str(tmp_path), "--county", "Dublin"],
        fetcher=FakeFetcher({}),
        sleep=no_sleep,
    )

    assert code == 1


@pytest.mark.parametrize("limit", ["0", "-3", "three"])
def test_limit_must_be_a_positive_number(tmp_path: Path, limit: str) -> None:
    with pytest.raises(SystemExit) as exit_info:
        main(
            [
                "--data-dir",
                str(tmp_path),
                "--county",
                "Dublin",
                "--limit",
                limit,
            ],
            fetcher=FakeFetcher({}),
            sleep=no_sleep,
        )

    assert exit_info.value.code == 2
