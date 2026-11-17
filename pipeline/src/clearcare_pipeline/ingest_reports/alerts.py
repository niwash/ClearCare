"""Turns the reports a batch wrote into alert events (ADR-0034, CCARE-248).

One event per scope value in the batch, never one per report: twelve reports for
one county are one county event and one whole-register event, with the report
ids in `metadata`. There is no report_id column, so the resolver matches an
event to a subscription by containment against the keys the event states.

A facility event also carries the county its centre is in, so a county
subscription matches the narrower event; the resolver's precedence
(FACILITY > COUNTY > RADIUS > ALL) then attributes the report once.
"""

from __future__ import annotations

import calendar
from collections import defaultdict
from collections.abc import Sequence
from datetime import date

from psycopg import Cursor

# A report whose fieldwork is older than this is not news: the first load of the
# backlog must not mail anything (CCARE-234).
RECENCY_MONTHS = 24

_PACKAGES = """
SELECT scope, id
FROM clearcare.alert_packages
WHERE is_active AND scope = ANY(%s)
"""

# The register, not the centre_search view: that one is the site's, and the
# pipeline holds no grant on it. The county a centre is in is read from the
# snapshot the pipeline itself loaded.
_COUNTIES = """
SELECT DISTINCT r.centre_id, co.id
FROM clearcare.register_entry r
JOIN clearcare.county co ON lower(co.name) = lower(r.county)
WHERE r.centre_id = ANY(%s)
"""

_INSERT = """
INSERT INTO clearcare.alert_events (alert_package_id, metadata)
VALUES (%s, CAST(%s AS jsonb))
"""

Written = tuple[int, str, date | None]


def cutoff(today: date) -> date:
    """The oldest fieldwork a new report may have and still be an alert."""
    year = today.year - RECENCY_MONTHS // 12
    day = min(today.day, calendar.monthrange(year, today.month)[1])
    return date(year, today.month, day)


def emit(
    cursor: Cursor,
    written: Sequence[Written],
    run_id: int | None = None,
    *,
    today: date | None = None,
) -> int:
    """Writes the events this batch is worth, and returns how many.

    `written` is what the caller stored: the report id, its centre and its
    fieldwork date. Events are written on the caller's cursor, so they commit
    with the reports or not at all.
    """
    oldest = cutoff(today or date.today())
    recent = [
        row for row in written if row[2] is None or row[2] >= oldest
    ]
    if not recent:
        return 0

    packages = dict(
        cursor.execute(_PACKAGES, (["FACILITY", "COUNTY", "ALL"],)).fetchall()
    )
    if not packages:
        # A deployment whose catalogue is empty has nothing to tell anyone, and
        # an event with no package cannot be written.
        return 0

    centres = sorted({centre for _, centre, _ in recent})
    counties = dict(cursor.execute(_COUNTIES, (centres,)).fetchall())

    by_centre: dict[str, list[int]] = defaultdict(list)
    by_county: dict[int, list[int]] = defaultdict(list)
    everything: list[int] = []
    for report_id, centre, _ in recent:
        by_centre[centre].append(report_id)
        county = counties.get(centre)
        if county is not None:
            by_county[county].append(report_id)
        everything.append(report_id)

    rows: list[tuple[int, str]] = []
    facility = packages.get("FACILITY")
    if facility is not None:
        for centre, report_ids in by_centre.items():
            metadata: dict[str, object] = {
                "centre_id": centre,
                "report_ids": sorted(report_ids),
            }
            county = counties.get(centre)
            if county is not None:
                metadata["county_id"] = county
            if run_id is not None:
                metadata["run_id"] = run_id
            rows.append((facility, _document(metadata)))

    county_package = packages.get("COUNTY")
    if county_package is not None:
        for county, report_ids in by_county.items():
            metadata = {"county_id": county, "report_ids": sorted(report_ids)}
            if run_id is not None:
                metadata["run_id"] = run_id
            rows.append((county_package, _document(metadata)))

    everything_package = packages.get("ALL")
    if everything_package is not None:
        metadata = {"report_ids": sorted(everything)}
        if run_id is not None:
            metadata["run_id"] = run_id
        rows.append((everything_package, _document(metadata)))

    if not rows:
        return 0
    cursor.executemany(_INSERT, rows)
    return len(rows)


def _document(metadata: dict[str, object]) -> str:
    import json

    return json.dumps(metadata, separators=(",", ":"))
