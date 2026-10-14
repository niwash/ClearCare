"""Command line entry point: ``python -m clearcare_pipeline.schedule``.

What it runs and when: CONTRIBUTING.md ("Pipeline and API") and ADR-0014.
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

from clearcare_pipeline.load_register.__main__ import main as load_register
from clearcare_pipeline.reports.__main__ import main as reports
from clearcare_pipeline.s3_settings import S3Settings, SettingsError
from clearcare_pipeline.snapshots.__main__ import main as snapshots
from clearcare_pipeline.upload.__main__ import main as upload

Stage = Callable[[Sequence[str]], int]

STAGES: Mapping[str, Stage] = {
    "snapshots": snapshots,
    "upload": upload,
    "load_register": load_register,
    "reports": reports,
}
STATE_NAME = "schedule-state.json"
CHECK_SECONDS = 3600.0
EXIT_SETTINGS_ERROR = 2

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Job:
    """A download from HIQA and the stages that run after every attempt."""

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


def _now() -> datetime:
    return datetime.now(UTC)


def main(
    argv: Sequence[str] | None = None,
    env: Mapping[str, str] | None = None,
    stages: Mapping[str, Stage] = STAGES,
    now: Callable[[], datetime] = _now,
    sleep: Callable[[float], None] = time.sleep,
) -> int:
    """Runs what is due now, and again every hour unless --once is given."""
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
    args = parser.parse_args(argv)
    data_dir: Path = args.data_dir
    env = os.environ if env is None else env
    state_path = data_dir / STATE_NAME
    try:
        bucket = _bucket_is_set(env)
        state = _read_state(state_path)
    except SettingsError as error:
        logger.error("%s", error)
        return EXIT_SETTINGS_ERROR
    except (ValueError, KeyError, TypeError, AttributeError) as error:
        logger.error("%s is not a schedule state file: %s", state_path, error)
        return 1
    crawl = env.get("CLEARCARE_CRAWL") or "off"
    logger.info(
        "CLEARCARE_CRAWL is %s; upload is %s", crawl, "on" if bucket else "off"
    )
    if bucket:
        _run_stage(stages, ("upload",), data_dir)
    _run_stage(stages, ("load_register",), data_dir)
    jobs = _jobs(crawl, bucket)
    while True:
        for job in jobs:
            if _due(job, state.get(job.name), now()):
                state = _run_job(job, state, data_dir, stages, now)
        if args.once:
            return 0
        sleep(CHECK_SECONDS)


def _bucket_is_set(env: Mapping[str, str]) -> bool:
    """Returns whether the bucket is set, and rejects partial settings."""
    if not any(v for k, v in env.items() if k.startswith("CLEARCARE_S3_")):
        return False
    S3Settings.from_env(env)
    return True


def _jobs(crawl: str, bucket: bool) -> tuple[Job, ...]:
    if crawl == "off":
        return ()
    upload_stages = ("upload",) if bucket else ()
    county = () if crawl == "all" else ("--county", crawl)
    return (
        Job(
            name="register",
            scope="all",
            download=("snapshots",),
            then=(*upload_stages, "load_register"),
            wait_after_success=timedelta(days=1),
        ),
        Job(
            name="reports",
            scope=crawl,
            download=("reports", *county),
            then=upload_stages,
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
) -> dict[str, JobState]:
    started = now()
    previous = state.get(job.name)
    attempt = JobState(
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
    new_state = {**state, job.name: attempt}
    _write_state(data_dir / STATE_NAME, new_state)
    logger.info("%s job (%s) started", job.name, job.scope)
    if _run_stage(stages, job.download, data_dir):
        attempt = replace(
            attempt,
            last_success=started,
            next_attempt=started + job.wait_after_success,
            last_outcome="succeeded",
        )
    else:
        attempt = replace(attempt, last_outcome="failed")
    new_state = {**new_state, job.name: attempt}
    _write_state(data_dir / STATE_NAME, new_state)
    logger.info(
        "%s job: download %s, next attempt %s",
        job.name,
        attempt.last_outcome,
        attempt.next_attempt.isoformat(timespec="seconds"),
    )
    for name in job.then:
        _run_stage(stages, (name,), data_dir)
    return new_state


def _run_stage(
    stages: Mapping[str, Stage], command: Sequence[str], data_dir: Path
) -> bool:
    """Runs a stage's main and returns whether it exited with status 0."""
    name, *options = command
    logger.info("%s started", name)
    try:
        status = stages[name](["--data-dir", str(data_dir), *options])
    except Exception:
        logger.exception("%s stopped with an exception", name)
        return False
    logger.log(
        logging.INFO if status == 0 else logging.ERROR,
        "%s finished with exit status %d",
        name,
        status,
    )
    return status == 0


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
