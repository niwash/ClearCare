import json
from pathlib import Path
from typing import Any

from clearcare_pipeline.price_lists.__main__ import main
from clearcare_pipeline.price_lists.page import PRICE_LISTS_PAGE
from clearcare_pipeline.raw_store import FileSystemRawStore
from tests.snapshots.fakes import FakeFetcher, failed, no_sleep, ok

FIXTURES = Path(__file__).parent / "fixtures"
PAGE = (FIXTURES / "fair-deal-about.html").read_bytes()
PRIVATE_URL = (
    "https://www2.hse.ie/documents/3223/"
    "HSE_Section40_List_230_Published_List_04.09.2026.pdf"
)
PUBLIC_URL = (
    "https://www2.hse.ie/documents/7322/"
    "NHSS_Cost_of_Care_September_2026_Update.pdf"
)
PRIVATE_PDF = b"%PDF-1.7 the private list"
PUBLIC_PDF = b"%PDF-1.7 the public list"


def _records(data_dir: Path) -> list[dict[str, Any]]:
    manifest = data_dir / "manifests" / "price-lists.jsonl"
    return [json.loads(line) for line in manifest.read_text().splitlines()]


def _stored(data_dir: Path, sha256: str) -> bytes:
    return FileSystemRawStore(data_dir / "raw").path_for(sha256).read_bytes()


def test_both_lists_are_stored_and_recorded_under_their_sources(
    tmp_path: Path,
) -> None:
    fetcher = FakeFetcher(
        {
            PRICE_LISTS_PAGE: [ok(PAGE, "text/html; charset=utf-8")],
            PUBLIC_URL: [ok(PUBLIC_PDF, "application/pdf")],
            PRIVATE_URL: [ok(PRIVATE_PDF, "application/pdf")],
        }
    )

    code = main(["--data-dir", str(tmp_path)], fetcher=fetcher, sleep=no_sleep)

    records = _records(tmp_path)
    assert code == 0
    assert [(r["source"], r["url"], r["error"]) for r in records] == [
        ("contract-price-public", PUBLIC_URL, None),
        ("contract-price-private", PRIVATE_URL, None),
    ]
    assert _stored(tmp_path, records[0]["sha256"]) == PUBLIC_PDF
    assert _stored(tmp_path, records[1]["sha256"]) == PRIVATE_PDF


def test_nothing_is_stored_when_the_page_does_not_load(tmp_path: Path) -> None:
    fetcher = FakeFetcher({PRICE_LISTS_PAGE: [failed(503)]})

    code = main(["--data-dir", str(tmp_path)], fetcher=fetcher, sleep=no_sleep)

    assert code == 1
    assert fetcher.calls == [PRICE_LISTS_PAGE]
    assert not (tmp_path / "raw").exists()
    assert not (tmp_path / "manifests").exists()


def test_a_list_that_fails_does_not_stop_the_other(tmp_path: Path) -> None:
    fetcher = FakeFetcher(
        {
            PRICE_LISTS_PAGE: [ok(PAGE, "text/html; charset=utf-8")],
            PUBLIC_URL: [failed(404)] * 3,
            PRIVATE_URL: [ok(PRIVATE_PDF, "application/pdf")],
        }
    )

    code = main(["--data-dir", str(tmp_path)], fetcher=fetcher, sleep=no_sleep)

    public, private = _records(tmp_path)
    assert code == 1
    assert (public["error"], public["attempts"]) == ("HTTP 404", 3)
    assert private["error"] is None
    assert _stored(tmp_path, private["sha256"]) == PRIVATE_PDF
