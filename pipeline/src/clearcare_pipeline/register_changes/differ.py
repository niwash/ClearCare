"""What changed in one centre's register entry between two snapshots."""

from dataclasses import dataclass
from datetime import date
from functools import partial
from typing import Literal
from zoneinfo import ZoneInfo

from clearcare_pipeline.load_register.conditions import (
    collapse_whitespace,
    extra_conditions,
)
from clearcare_pipeline.load_register.register_csv import RegisterEntry
from clearcare_pipeline.reports.register import RegisterDownload

# Stored with every row (db/V21). Give it a new value when a rule here or in
# load_register/conditions.py is altered: rows are only ever added, so those
# of the earlier version stay beside the new ones.
RULES_VERSION = "rules-v1"
# A change is dated by the day its snapshot was fetched, and that day is
# counted in Ireland, where the register's readers are.
IRISH_TIME = ZoneInfo("Europe/Dublin")

Kind = Literal[
    "registration",
    "provider",
    "name",
    "beds",
    "condition_added",
    "condition_removed",
    "condition_changed",
    "note_added",
    "note_removed",
]


@dataclass(frozen=True)
class RegisterChange:
    """One change to a centre's register entry, as db/V21 stores it.

    A field the kind does not use is None. Text is kept with whitespace
    collapsed.

    Attributes:
        centre_id: The centre's HIQA centre ID.
        kind: What changed.
        change_date: The registration date for a registration; for every
            other kind the day the change was first seen, shown_on.
        shown_on: The Irish day the snapshot with the change was fetched.
        snapshot_sha256: That snapshot's file in the raw store.
        condition_number: The extra condition added, removed or changed.
        before_text: The earlier provider, centre name, condition or note.
        after_text: The later one.
        beds_before: The earlier maximum occupancy.
        beds_after: The later one.
        registered_until: A registration's expiry date.
        registration_number: A registration's number.
    """

    centre_id: str
    kind: Kind
    change_date: date
    shown_on: date
    snapshot_sha256: str
    condition_number: int | None = None
    before_text: str | None = None
    after_text: str | None = None
    beds_before: int | None = None
    beds_after: int | None = None
    registered_until: date | None = None
    registration_number: str | None = None


def register_changes(
    previous: RegisterEntry | None,
    current: RegisterEntry,
    download: RegisterDownload,
) -> tuple[RegisterChange, ...]:
    """Returns what changed for a centre since the last entry seen for it.

    Args:
        previous: The centre's entry in the last snapshot that had it, or
            None if no earlier snapshot did.
        current: Its entry in this snapshot.
        download: The download this snapshot came from.
    """
    shown_on = download.fetched_at.astimezone(IRISH_TIME).date()
    seen = partial(
        RegisterChange,
        centre_id=current.centre_id,
        change_date=shown_on,
        shown_on=shown_on,
        snapshot_sha256=download.sha256,
    )
    # HIQA gives a renewal a new number. The register shows it some time
    # after it started, so it is dated by its own date.
    registration = seen(
        kind="registration",
        change_date=current.registration_date,
        registered_until=current.registration_expiry_date,
        registration_number=current.registration_number,
    )
    if previous is None:
        return (registration,)
    changes: list[RegisterChange] = []
    if previous.registration_number != current.registration_number:
        changes.append(registration)
    # A provider is identified by its CRO number, and only a company has
    # one. The names of providers without one can be people's, so they are
    # not kept.
    cro_before = _text(previous.provider_cro_number)
    cro_after = _text(current.provider_cro_number)
    if cro_before != cro_after:
        changes.append(
            seen(
                kind="provider",
                before_text=_text(previous.provider_name)
                if cro_before
                else None,
                after_text=_text(current.provider_name) if cro_after else None,
            )
        )
    name_before = _text(previous.centre_name)
    name_after = _text(current.centre_name)
    if name_before != name_after:
        changes.append(
            seen(kind="name", before_text=name_before, after_text=name_after)
        )
    if previous.maximum_occupancy != current.maximum_occupancy:
        changes.append(
            seen(
                kind="beds",
                beds_before=previous.maximum_occupancy,
                beds_after=current.maximum_occupancy,
            )
        )
    before = _extras_by_number(previous)
    after = _extras_by_number(current)
    for number in sorted(before.keys() | after.keys()):
        if number not in before:
            changes.append(
                seen(
                    kind="condition_added",
                    condition_number=number,
                    after_text=after[number],
                )
            )
        elif number not in after:
            changes.append(
                seen(
                    kind="condition_removed",
                    condition_number=number,
                    before_text=before[number],
                )
            )
        elif before[number] != after[number]:
            changes.append(
                seen(
                    kind="condition_changed",
                    condition_number=number,
                    before_text=before[number],
                    after_text=after[number],
                )
            )
    note_before = _text(previous.chief_inspector_note)
    note_after = _text(current.chief_inspector_note)
    if note_after and note_after != note_before:
        changes.append(seen(kind="note_added", after_text=note_after))
    elif note_before and not note_after:
        changes.append(seen(kind="note_removed", before_text=note_before))
    return tuple(changes)


def _text(value: str | None) -> str | None:
    """The value as it is compared and kept; None if it holds nothing."""
    return collapse_whitespace(value or "") or None


def _extras_by_number(entry: RegisterEntry) -> dict[int, str]:
    return {
        condition.number: condition.text
        for condition in extra_conditions(entry.conditions_of_registration)
    }
