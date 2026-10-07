"""Choosing centres from the latest snapshot of the register of centres."""

import csv
import io
import json
from dataclasses import dataclass
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path

from clearcare_pipeline.snapshots.sources import OLDER_PERSONS_REGISTER

CENTRE_PAGE_PREFIX = "https://www.hiqa.ie/"
_COLUMNS = ("Centre_ID", "County", "URL")


@dataclass(frozen=True)
class RegisteredCentre:
    """A centre on the register and the HIQA page that lists its reports."""

    centre_id: str
    url: str


@dataclass(frozen=True)
class RegisterDownload:
    """A successful download of the register, as the manifest records it.

    last_modified is HIQA's Last-Modified header, if it sent one that parses.
    """

    sha256: str
    url: str
    fetched_at: datetime
    last_modified: datetime | None


class RegisterError(Exception):
    """The register snapshot is missing or not in the expected form."""


def latest_register_sha256(manifest: Path) -> str:
    """Returns the hash of the newest stored snapshot of the register.

    Raises:
        RegisterError: If the manifest has no successful snapshot of the
            register of centres, or a line is not a snapshot record.
    """
    return latest_register_download(manifest).sha256


def latest_register_download(manifest: Path) -> RegisterDownload:
    """Returns the newest successful download of the register.

    Raises:
        RegisterError: If the manifest has no successful snapshot of the
            register of centres, or a line is not a snapshot record.
    """
    lines = (
        manifest.read_text(encoding="utf-8").splitlines()
        if manifest.is_file()
        else []
    )
    latest: RegisterDownload | None = None
    for number, line in enumerate(lines, 1):
        try:
            record = json.loads(line)
            if (
                record["source"] == OLDER_PERSONS_REGISTER.name
                and record["error"] is None
                and isinstance(record["sha256"], str)
            ):
                latest = RegisterDownload(
                    sha256=record["sha256"],
                    url=record["url"],
                    fetched_at=datetime.fromisoformat(record["fetched_at"]),
                    last_modified=_http_date(record["last_modified"]),
                )
        except (ValueError, KeyError, TypeError) as problem:
            raise RegisterError(
                f"{manifest.name} line {number}: not a snapshot record"
            ) from problem
    if latest is None:
        raise RegisterError(
            f"{manifest.name} has no successful snapshot of the register"
        )
    return latest


def _http_date(value: str | None) -> datetime | None:
    # The header is only a note on the download, so one that does not parse
    # is left out rather than stopping the run.
    try:
        return parsedate_to_datetime(value) if value else None
    except ValueError:
        return None


def centres_in_county(
    register_csv: bytes, county: str
) -> tuple[RegisteredCentre, ...]:
    """Returns the centres in a county, in register order.

    Raises:
        RegisterError: If a column is missing or a centre's page is not on
            HIQA's site.
    """
    rows = csv.DictReader(io.StringIO(register_csv.decode("utf-8")))
    missing = [name for name in _COLUMNS if name not in (rows.fieldnames or [])]
    if missing:
        raise RegisterError(f"register has no {', '.join(missing)} column")
    centres = tuple(
        RegisteredCentre(centre_id=row["Centre_ID"], url=row["URL"])
        for row in rows
        if row["County"] == county
    )
    for centre in centres:
        if not centre.url.startswith(CENTRE_PAGE_PREFIX):
            raise RegisterError(
                f"centre {centre.centre_id}: page {centre.url!r} "
                f"is not on {CENTRE_PAGE_PREFIX}"
            )
    return centres
