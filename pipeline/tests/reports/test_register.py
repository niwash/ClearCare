import json
from pathlib import Path

import pytest

from clearcare_pipeline.reports.register import (
    RegisteredCentre,
    RegisterError,
    centres_in_county,
    latest_register_sha256,
)

REGISTER = (
    b"Centre_ID,Centre_Title,County,URL\n"
    b"1,Aclare House Nursing Home,Dublin,"
    b"https://www.hiqa.ie/areas-we-work/find-a-centre/aclare-house-nursing-home\n"
    b"34,Elm Hall Nursing Home,Kildare,"
    b"https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall-nursing-home\n"
    b"4,Altadore Nursing Home,Dublin,"
    b"https://www.hiqa.ie/areas-we-work/find-a-centre/altadore-nursing-home\n"
)


def _snapshot_line(source: str, sha256: str | None, error: str | None) -> str:
    return json.dumps(
        {
            "source": source,
            "fetched_at": "2026-10-02T06:05:32+00:00",
            "sha256": sha256,
            "error": error,
        }
    )


def _manifest(tmp_path: Path, *lines: str) -> Path:
    path = tmp_path / "register-snapshots.jsonl"
    path.write_text("".join(line + "\n" for line in lines))
    return path


def test_latest_register_is_the_last_successful_snapshot(
    tmp_path: Path,
) -> None:
    manifest = _manifest(
        tmp_path,
        _snapshot_line("older_persons_register", "aaa", None),
        _snapshot_line("older_persons_register", "bbb", None),
        _snapshot_line("section_64_register", "ccc", None),
        _snapshot_line("older_persons_register", None, "HTTP 503"),
    )

    assert latest_register_sha256(manifest) == "bbb"


def test_no_successful_register_snapshot_is_an_error(tmp_path: Path) -> None:
    manifest = _manifest(
        tmp_path,
        _snapshot_line("older_persons_register", None, "HTTP 503"),
    )

    with pytest.raises(RegisterError, match="no successful snapshot"):
        latest_register_sha256(manifest)


def test_missing_manifest_is_an_error(tmp_path: Path) -> None:
    with pytest.raises(RegisterError, match="no successful snapshot"):
        latest_register_sha256(tmp_path / "register-snapshots.jsonl")


def test_unreadable_manifest_line_is_an_error(tmp_path: Path) -> None:
    manifest = _manifest(tmp_path, "not json")

    with pytest.raises(RegisterError, match="line 1: not a snapshot record"):
        latest_register_sha256(manifest)


def test_centres_in_county_keeps_register_order() -> None:
    assert centres_in_county(REGISTER, "Dublin") == (
        RegisteredCentre(
            centre_id="1",
            url="https://www.hiqa.ie/areas-we-work/find-a-centre/"
            "aclare-house-nursing-home",
        ),
        RegisteredCentre(
            centre_id="4",
            url="https://www.hiqa.ie/areas-we-work/find-a-centre/"
            "altadore-nursing-home",
        ),
    )


def test_register_without_expected_columns_is_an_error() -> None:
    with pytest.raises(RegisterError, match="URL"):
        centres_in_county(b"Centre_ID,County\n1,Dublin\n", "Dublin")


def test_centre_page_outside_hiqa_is_an_error() -> None:
    register = b"Centre_ID,County,URL\n1,Dublin,https://example.com/1\n"

    with pytest.raises(RegisterError, match="centre 1"):
        centres_in_county(register, "Dublin")
