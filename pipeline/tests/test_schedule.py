import functools
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from clearcare_pipeline.schedule.__main__ import STAGES, Stage, main

START = datetime(2026, 10, 14, 6, 0, tzinfo=UTC)
BUCKET = {
    "CLEARCARE_S3_ENDPOINT": "https://storage.example",
    "CLEARCARE_S3_REGION": "uk-london-1",
    "CLEARCARE_S3_BUCKET": "clearcare-raw",
    "CLEARCARE_S3_ACCESS_KEY_ID": "key-id",
    "CLEARCARE_S3_SECRET_ACCESS_KEY": "secret",
}
STARTUP = [
    "upload",
    "load_register",
    "load_contract_prices",
    "load_report_files",
    "ingest_reports",
    "extract_text",
    "extract_about",
    "split_commitments",
]
REGISTER_JOB = ["snapshots", "upload", "load_register"]
PRICES_JOB = ["price_lists", "upload", "load_contract_prices"]
REPORTS_JOB = [
    "reports",
    "upload",
    "load_report_files",
    "ingest_reports",
    "extract_text",
    "extract_about",
    "split_commitments",
]
EVERY_STAGE_OF_EVERY_JOB = [*STARTUP, *REGISTER_JOB, *PRICES_JOB, *REPORTS_JOB]


class Stopped(BaseException):
    """The container was stopped while a stage was running."""


class FakeStages:
    """Stage mains that record each call and return or raise their outcome."""

    def __init__(
        self, outcomes: Mapping[str, int | BaseException] | None = None
    ) -> None:
        self._outcomes = outcomes or {}
        self.calls: list[tuple[str, ...]] = []

    def mains(self) -> dict[str, Stage]:
        return {name: functools.partial(self._run, name) for name in STAGES}

    def names(self) -> list[str]:
        return [name for name, *_ in self.calls]

    def _run(self, name: str, argv: Sequence[str]) -> int:
        self.calls.append((name, *argv))
        outcome = self._outcomes.get(name, 0)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome


def _start(
    data_dir: Path,
    stages: FakeStages,
    at: datetime,
    crawl: str = "all",
    bucket: Mapping[str, str] = BUCKET,
) -> int:
    return main(
        ["--data-dir", str(data_dir), "--once"],
        env={"CLEARCARE_CRAWL": crawl, **bucket},
        stages=stages.mains(),
        now=lambda: at,
    )


def test_first_start_uploads_and_loads_then_runs_every_job(
    tmp_path: Path,
) -> None:
    stages = FakeStages()

    code = _start(tmp_path, stages, START)

    assert code == 0
    assert stages.names() == EVERY_STAGE_OF_EVERY_JOB


def test_after_a_failed_crawl_nothing_runs_for_a_day_even_after_a_restart(
    tmp_path: Path,
) -> None:
    stages = FakeStages({"reports": 1})
    _start(tmp_path, stages, START)

    stages.calls.clear()
    _start(tmp_path, stages, START + timedelta(hours=23))
    assert stages.names() == STARTUP

    stages.calls.clear()
    _start(tmp_path, stages, START + timedelta(hours=24))
    assert stages.names() == [*STARTUP, *REGISTER_JOB, *REPORTS_JOB]


def test_a_crawl_stopped_midway_waits_a_day_too(tmp_path: Path) -> None:
    with pytest.raises(Stopped):
        _start(tmp_path, FakeStages({"reports": Stopped()}), START)

    stages = FakeStages()
    _start(tmp_path, stages, START + timedelta(hours=1))

    assert stages.names() == STARTUP


def test_upload_and_load_run_after_failed_downloads_and_uploads(
    tmp_path: Path,
) -> None:
    stages = FakeStages(
        {
            "snapshots": 1,
            "price_lists": 1,
            "reports": RuntimeError("unexpected page"),
            "upload": 1,
            # Backfill exits 1 while a response is missing from its source.
            "extract_text": 1,
        }
    )

    _start(tmp_path, stages, START)

    assert stages.names() == EVERY_STAGE_OF_EVERY_JOB


def test_the_price_lists_are_downloaded_once_a_week(tmp_path: Path) -> None:
    _start(tmp_path, FakeStages(), START)

    stages = FakeStages()
    _start(tmp_path, stages, START + timedelta(days=6))
    assert stages.names() == [*STARTUP, *REGISTER_JOB]

    stages.calls.clear()
    _start(tmp_path, stages, START + timedelta(days=7))
    assert stages.names() == EVERY_STAGE_OF_EVERY_JOB


def test_without_a_bucket_nothing_is_uploaded(tmp_path: Path) -> None:
    stages = FakeStages()

    _start(tmp_path, stages, START, bucket={})

    assert "upload" not in stages.names()


def test_a_new_crawl_scope_makes_the_reports_job_due(tmp_path: Path) -> None:
    stages = FakeStages()
    _start(tmp_path, stages, START, crawl="Kildare")
    assert ("reports", "--data-dir", str(tmp_path), "--county", "Kildare") in (
        stages.calls
    )

    stages.calls.clear()
    _start(tmp_path, stages, START + timedelta(hours=1), crawl="all")

    assert stages.names() == [*STARTUP, *REPORTS_JOB]
    assert ("reports", "--data-dir", str(tmp_path)) in stages.calls


def test_crawl_off_only_uploads_and_loads_what_is_there(tmp_path: Path) -> None:
    stages = FakeStages()

    _start(tmp_path, stages, START, crawl="off")

    assert stages.names() == STARTUP
