"""The append-only manifest of centre pages and their report files."""

import json
from dataclasses import asdict, dataclass
from pathlib import Path

from clearcare_pipeline.reports.centre_page import Report

MANIFEST_NAME = "inspection-reports.jsonl"


@dataclass(frozen=True)
class CentreRecord:
    """The manifest entry for one centre in one run.

    Attributes:
        centre_id: HIQA centre ID from the register.
        url: The centre page.
        fetched_at: When the centre page was fetched, in UTC.
        page_sha256: Hash of the stored centre page, or None.
        reports: Every report the page lists, newest inspection first.
        error: Why the centre page could not be used, or None.
    """

    centre_id: str
    url: str
    fetched_at: str
    page_sha256: str | None
    reports: tuple[Report, ...]
    error: str | None


class ManifestError(Exception):
    """A manifest line is not a centre record."""


def append_record(path: Path, record: CentreRecord) -> None:
    """Appends the record to the manifest as one JSON line."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as manifest:
        manifest.write(json.dumps(asdict(record), sort_keys=True) + "\n")


def stored_report_files(path: Path) -> dict[str, Report]:
    """Returns the last stored copy of each report file, by file name.

    Raises:
        ManifestError: If a line cannot be read as a centre record.
    """
    if not path.is_file():
        return {}
    stored: dict[str, Report] = {}
    lines = path.read_text(encoding="utf-8").splitlines()
    for number, line in enumerate(lines, 1):
        try:
            reports = [
                Report(**report) for report in json.loads(line)["reports"]
            ]
        except (ValueError, KeyError, TypeError) as problem:
            raise ManifestError(
                f"{path.name} line {number}: not a centre record"
            ) from problem
        stored.update(
            (report.file_name, report)
            for report in reports
            if report.sha256 is not None
        )
    return stored


def last_page_checks(path: Path) -> dict[str, str]:
    """Returns when each centre's page was last read and it worked.

    The result maps the centre ID to the read's fetched_at, in UTC. A read
    with an error was not a look at the reports, so it is left out, and an
    earlier read that worked stands. Errors in the reports' own downloads do
    not matter here: the page was still read.

    Raises:
        ManifestError: If a line cannot be read as a centre record.
    """
    if not path.is_file():
        return {}
    checks: dict[str, str] = {}
    lines = path.read_text(encoding="utf-8").splitlines()
    for number, line in enumerate(lines, 1):
        try:
            record = json.loads(line)
            centre_id, checked_at = record["centre_id"], record["fetched_at"]
            error = record["error"]
        except (ValueError, KeyError, TypeError) as problem:
            raise ManifestError(
                f"{path.name} line {number}: not a centre record"
            ) from problem
        if error is None and checked_at > checks.get(centre_id, ""):
            checks[centre_id] = checked_at
    return checks
