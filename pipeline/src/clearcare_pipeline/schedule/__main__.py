"""Command line entry point: ``python -m clearcare_pipeline.schedule``.

What it runs and when: CONTRIBUTING.md ("Pipeline and API") and ADR-0014.
What one run is, and what it locks: ADR-0022.
"""

import argparse
import json
import logging
import os
import sys
import time
from collections.abc import Callable, Mapping, Sequence
from dataclasses import asdict, dataclass, replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Protocol

import psycopg

from clearcare_pipeline.amenities.__main__ import main as amenities
from clearcare_pipeline.contract_prices.__main__ import (
    main as load_contract_prices,
)
from clearcare_pipeline.exit_codes import EXIT_DONE, EXIT_FAILED, EXIT_RETRY
from clearcare_pipeline.extract_text import main as extract_text
from clearcare_pipeline.geocode.__main__ import main as geocode
from clearcare_pipeline.ingest_reports.__main__ import main as ingest_reports
from clearcare_pipeline.load_register.__main__ import main as load_register
from clearcare_pipeline.load_report_files.__main__ import (
    main as load_report_files,
)
from clearcare_pipeline.object_store import (
    ObjectStore,
    ObjectStoreError,
    S3ObjectStore,
)
from clearcare_pipeline.pipeline_run import PipelineRun
from clearcare_pipeline.price_lists.__main__ import main as price_lists
from clearcare_pipeline.reports.__main__ import main as reports
from clearcare_pipeline.s3_settings import (
    S3Settings,
    SettingsError,
    make_s3_client,
)
from clearcare_pipeline.schedule import bucket_state
from clearcare_pipeline.snapshots.__main__ import main as snapshots
from clearcare_pipeline.split_commitments import main as split_commitments
from clearcare_pipeline.upload.__main__ import main as upload

Stage = Callable[[Sequence[str]], int]

STAGES: Mapping[str, Stage] = {
    "snapshots": snapshots,
    "upload": upload,
    "load_register": load_register,
    # It reads only the database and Google, so it takes no data directory.
    "geocode": lambda _: geocode([]),
    "price_lists": price_lists,
    "load_contract_prices": load_contract_prices,
    "reports": reports,
    "load_report_files": load_report_files,
    "ingest_reports": ingest_reports,
    "extract_text": extract_text,
    "amenities": amenities,
    # It reads only stored text, so it takes no data directory.
    "split_commitments": lambda _: split_commitments([]),
}
STATE_NAME = "schedule-state.json"
CHECK_SECONDS = 3600.0
# The object store's settings are not a stage's answer, so the run has its
# own code for them; the stage codes are clearcare_pipeline.exit_codes.
EXIT_SETTINGS_ERROR = 2

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Job:
    """A download and the stages that run after every attempt."""

    name: str
    scope: str
    download: tuple[str, ...]
    then: tuple[str, ...]
    wait_after_success: timedelta


@dataclass(frozen=True)
class JobState:
    """A job's state; outcome "started" means its download did not finish."""

    scope: str
    last_success: datetime | None
    next_attempt: datetime
    last_outcome: str


@dataclass
class Attempt:
    """What one bounded run did, for its exit code and its ledger row.

    ``incomplete`` is work the next run retries: a crawl HIQA would not
    answer, or reports this version cannot read. The run finished, so it is
    not a failure, but less happened than was due.
    """

    failure: str | None = None
    incomplete: bool = False
    # A container that is stopped never reaches the end of the run.
    completed: bool = False

    def note(self, stage: str, status: int) -> None:
        """Keeps the first stage that ended with a status other than 0."""
        if self.failure is None:
            self.failure = f"{stage} exited with status {status}"

    @property
    def outcome(self) -> str:
        """The run's outcome, as ``clearcare.pipeline_run`` spells it."""
        if self.failure is not None or not self.completed:
            return "failed"
        return "incomplete" if self.incomplete else "succeeded"

    @property
    def detail(self) -> str | None:
        """The first failure, or that the run never got to its end."""
        if self.failure is not None:
            return self.failure
        if not self.completed:
            return "the run stopped before it finished"
        return None


class Run(Protocol):
    """What ``main`` needs of a run: its lock, and its ledger row."""

    def finish(self, outcome: str, exit_code: int, detail: str | None) -> None:
        """Closes the run's row with how it ended."""

    def close(self) -> None:
        """Releases the run lock."""


def _now() -> datetime:
    return datetime.now(UTC)


def main(
    argv: Sequence[str] | None = None,
    env: Mapping[str, str] | None = None,
    stages: Mapping[str, Stage] = STAGES,
    now: Callable[[], datetime] = _now,
    sleep: Callable[[float], None] = time.sleep,
    store: ObjectStore | None = None,
    begin: Callable[[], Run | None] | None = None,
) -> int:
    """Runs what is due now, and again every hour unless --once is given.

    With --once it is one run: it takes the run lock, records itself in
    ``clearcare.pipeline_run``, and exits as ``exit_codes`` says. ADR-0022.
    """
    parser = argparse.ArgumentParser(
        description="Run the pipeline's stages when they are due."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        required=True,
        help="directory that holds raw/ and manifests/",
    )
    parser.add_argument(
        "--once", action="store_true", help="run what is due, then exit"
    )
    parser.add_argument(
        "--bucket-state",
        action="store_true",
        help="restore the data directory from the bucket first, and keep the"
        " schedule state and the manifests there",
    )
    args = parser.parse_args(argv)
    env = os.environ if env is None else env
    attempt = Attempt()
    if not args.once:
        # The long-running pipeline of the VM is not a run: it holds nothing
        # while it sleeps, and the VM's database is not the one a migration
        # is ever run against.
        return _run_due(args, env, stages, now, sleep, store, attempt)
    try:
        guarded = begin() if begin is not None else _begin()
    except psycopg.Error as error:
        logger.error("cannot start a run: %s", error)
        return EXIT_FAILED
    if guarded is None:
        logger.warning(
            "another run or a migration holds the lock; nothing to do"
        )
        return EXIT_DONE
    code = EXIT_FAILED
    try:
        code = _run_due(args, env, stages, now, sleep, store, attempt)
    finally:
        guarded.finish(attempt.outcome, code, attempt.detail)
        guarded.close()
    return code


def _begin() -> Run | None:
    """Takes the run lock and opens its row; None if someone else has it."""
    return PipelineRun.try_begin()


def _run_due(
    args: argparse.Namespace,
    env: Mapping[str, str],
    stages: Mapping[str, Stage],
    now: Callable[[], datetime],
    sleep: Callable[[float], None],
    store: ObjectStore | None,
    attempt: Attempt,
) -> int:
    """Runs the startup stages and every job that is due."""
    data_dir: Path = args.data_dir
    state_path = data_dir / STATE_NAME
    try:
        bucket = _bucket_is_set(env)
        checkpoints = (store or _store_from(env)) if args.bucket_state else None
        if checkpoints is not None:
            bucket_state.restore(checkpoints, data_dir, state_path)
        state = _read_state(state_path)
    except SettingsError as error:
        logger.error("%s", error)
        attempt.failure = str(error)
        return EXIT_SETTINGS_ERROR
    except (bucket_state.BucketStateError, ObjectStoreError) as error:
        logger.error("cannot restore the data directory: %s", error)
        attempt.failure = str(error)
        return EXIT_FAILED
    except (ValueError, KeyError, TypeError, AttributeError) as error:
        logger.error("%s is not a schedule state file: %s", state_path, error)
        attempt.failure = f"{state_path} is not a schedule state file"
        return EXIT_FAILED
    crawl = env.get("CLEARCARE_CRAWL") or "off"
    logger.info(
        "CLEARCARE_CRAWL is %s; upload is %s", crawl, "on" if bucket else "off"
    )
    # A failed upload is the run's failure, but the data directory is still
    # worth loading: it holds what the last task uploaded.
    if bucket:
        _run_stage(stages, ("upload",), data_dir, attempt)
    # The centres first, as a report or a price is loaded only for a stored
    # centre, and the geocoder reads the served register. Text extraction then
    # writes only what this pipeline version lacks.
    for name in (
        "load_register",
        "geocode",
        "load_contract_prices",
        "load_report_files",
        "ingest_reports",
        "extract_text",
        "split_commitments",
        "amenities",
    ):
        _run_stage(stages, (name,), data_dir, attempt)
    jobs = _jobs(crawl)
    while True:
        for job in jobs:
            if not _due(job, state.get(job.name), now()):
                continue
            try:
                state = _run_job(
                    job,
                    state,
                    data_dir,
                    stages,
                    now,
                    bucket,
                    checkpoints,
                    attempt,
                )
            except (bucket_state.BucketStateError, ObjectStoreError) as error:
                logger.error("%s job: %s", job.name, error)
                attempt.note(f"{job.name} job", EXIT_FAILED)
                return EXIT_FAILED
        if args.once:
            attempt.completed = True
            return EXIT_DONE if attempt.failure is None else EXIT_FAILED
        sleep(CHECK_SECONDS)


def _bucket_is_set(env: Mapping[str, str]) -> bool:
    """Returns whether the bucket is set, and rejects partial settings."""
    if not any(v for k, v in env.items() if k.startswith("CLEARCARE_S3_")):
        return False
    S3Settings.from_env(env)
    return True


def _store_from(env: Mapping[str, str]) -> ObjectStore:
    settings = S3Settings.from_env(env)
    return S3ObjectStore(make_s3_client(settings), settings.bucket)


def _jobs(crawl: str) -> tuple[Job, ...]:
    if crawl == "off":
        return ()
    county = () if crawl == "all" else ("--county", crawl)
    return (
        # Geocoding here as well as at start, as a long-running pipeline
        # (Compose) runs the startup stages only once.
        Job(
            name="register",
            scope="all",
            download=("snapshots",),
            then=("load_register", "geocode"),
            wait_after_success=timedelta(days=1),
        ),
        # HSE republishes the lists about once a month.
        Job(
            name="prices",
            scope="all",
            download=("price_lists",),
            then=("load_contract_prices",),
            wait_after_success=timedelta(days=7),
        ),
        Job(
            name="reports",
            scope=crawl,
            download=("reports", *county),
            then=(
                "load_report_files",
                "ingest_reports",
                "extract_text",
                "split_commitments",
                "amenities",
            ),
            wait_after_success=timedelta(days=7),
        ),
    )


def _due(job: Job, state: JobState | None, now: datetime) -> bool:
    return (
        state is None or state.scope != job.scope or now >= state.next_attempt
    )


def _run_job(
    job: Job,
    state: Mapping[str, JobState],
    data_dir: Path,
    stages: Mapping[str, Stage],
    now: Callable[[], datetime],
    bucket: bool,
    checkpoints: ObjectStore | None,
    attempt: Attempt,
) -> dict[str, JobState]:
    """Runs a job's download, the upload and the stages after it.

    Raises:
        BucketStateError: If the upload failed with --bucket-state.
        ObjectStoreError: If the checkpoint was not written.
    """
    started = now()
    previous = state.get(job.name)
    attempt_state = JobState(
        scope=job.scope,
        last_success=(
            previous.last_success
            if previous and previous.scope == job.scope
            else None
        ),
        # A day, as a crawl stops at HIQA's verification page or on 429s.
        next_attempt=started + timedelta(days=1),
        last_outcome="started",
    )
    new_state = {**state, job.name: attempt_state}
    _write_state(data_dir / STATE_NAME, new_state)
    if checkpoints is not None:
        # Before HIQA is contacted, so a new task cannot bring a crawl
        # forward either (ADR-0014).
        bucket_state.save(checkpoints, data_dir, data_dir / STATE_NAME)
    logger.info("%s job (%s) started", job.name, job.scope)
    status = _run_stage(stages, job.download, data_dir, attempt)
    if status == 0:
        attempt_state = replace(
            attempt_state,
            last_success=started,
            next_attempt=started + job.wait_after_success,
            last_outcome="succeeded",
        )
    elif status == EXIT_RETRY:
        # The download is retried on the job's own schedule.
        attempt_state = replace(attempt_state, last_outcome="incomplete")
    else:
        attempt_state = replace(attempt_state, last_outcome="failed")
    new_state = {**new_state, job.name: attempt_state}
    _write_state(data_dir / STATE_NAME, new_state)
    logger.info(
        "%s job: download %s, next attempt %s",
        job.name,
        attempt_state.last_outcome,
        attempt_state.next_attempt.isoformat(timespec="seconds"),
    )
    uploaded = True
    if bucket:
        uploaded = _run_stage(stages, ("upload",), data_dir, attempt) == 0
    if checkpoints is not None:
        # The checkpoint may list only files the bucket holds, so a failed
        # upload leaves the one written before the download.
        if not uploaded:
            raise bucket_state.BucketStateError(
                "upload failed; the checkpoint is kept"
            )
        bucket_state.save(checkpoints, data_dir, data_dir / STATE_NAME)
    for name in job.then:
        _run_stage(stages, (name,), data_dir, attempt)
    return new_state


def _run_stage(
    stages: Mapping[str, Stage],
    command: Sequence[str],
    data_dir: Path,
    attempt: Attempt,
) -> int:
    """Runs a stage's main and returns its exit status."""
    name, *options = command
    logger.info("%s started", name)
    try:
        status = stages[name](["--data-dir", str(data_dir), *options])
    except Exception:
        logger.exception("%s stopped with an exception", name)
        attempt.note(name, EXIT_FAILED)
        return EXIT_FAILED
    if status == EXIT_RETRY:
        # Work the next run retries: the run finished, but not all of it.
        attempt.incomplete = True
    elif status != EXIT_DONE:
        attempt.note(name, status)
    level = (
        logging.ERROR
        if status not in (EXIT_DONE, EXIT_RETRY)
        else (logging.WARNING if status == EXIT_RETRY else logging.INFO)
    )
    logger.log(level, "%s finished with exit status %d", name, status)
    return status


def _read_state(path: Path) -> dict[str, JobState]:
    if not path.exists():
        return {}
    return {
        name: JobState(
            scope=entry["scope"],
            last_success=(
                datetime.fromisoformat(entry["last_success"])
                if entry["last_success"]
                else None
            ),
            next_attempt=datetime.fromisoformat(entry["next_attempt"]),
            last_outcome=entry["last_outcome"],
        )
        for name, entry in json.loads(path.read_text("utf-8")).items()
    }


def _write_state(path: Path, state: Mapping[str, JobState]) -> None:
    """Replaces the state file in one step, so it is never half written."""
    temporary = path.with_name(f".{path.name}.tmp")
    entries = {name: asdict(job) for name, job in state.items()}
    temporary.write_text(
        json.dumps(entries, default=datetime.isoformat, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    sys.exit(main())
