from dataclasses import replace
from datetime import UTC, date, datetime

import pytest

from clearcare_pipeline.load_register.register_csv import (
    RegisterEntry,
    read_register,
)
from clearcare_pipeline.register_changes.differ import (
    RegisterChange,
    register_changes,
)
from clearcare_pipeline.reports.register import RegisterDownload
from clearcare_pipeline.snapshots.sources import OLDER_PERSONS_REGISTER
from tests.load_register.fakes import centre, register_csv

SHA256 = "a" * 64
TUESDAY = RegisterDownload(
    sha256=SHA256,
    url=OLDER_PERSONS_REGISTER.url,
    fetched_at=datetime(2026, 10, 6, 6, 3, 11, tzinfo=UTC),
    last_modified=None,
)
# A change first seen in Tuesday's snapshot, before its kind and fields.
SEEN_ON_TUESDAY = RegisterChange(
    centre_id="34",
    kind="name",
    change_date=date(2026, 10, 6),
    shown_on=date(2026, 10, 6),
    snapshot_sha256=SHA256,
)
USUAL_THREE = (
    "Condition 1 The designated centre shall be operated in accordance with"
    " the Statement of Purpose.Condition 2Only persons aged 18 years or older"
    " shall be accommodated at the designated centre at any time.Condition 3"
    "The maximum number of persons that may be accommodated at the designated"
    " centre is: 62."
)
NO_ADMISSIONS = "No new residents may be admitted to rooms 28 and 29."
NOTE = (
    "The registered provider has notified the chief inspector of their"
    " intention to cease and close the designated centre."
)


def _entry(**columns: str) -> RegisterEntry:
    """Elm Hall's entry as the reader gives it, with any columns changed."""
    return read_register(register_csv(centre("34", **columns)))[0]


def test_a_centre_not_seen_before_gets_only_its_registration() -> None:
    first = _entry(
        Registration_Conditions=f"{USUAL_THREE}Condition 4{NO_ADMISSIONS}",
        Chief_Inspector_Note=NOTE,
    )

    assert register_changes(None, first, TUESDAY) == (
        RegisterChange(
            centre_id="34",
            kind="registration",
            # The day the registration started, not the day it was seen.
            change_date=date(2024, 3, 14),
            shown_on=date(2026, 10, 6),
            snapshot_sha256=SHA256,
            registered_until=date(2027, 3, 13),
            registration_number="REG-0012345",
        ),
    )


def test_an_entry_that_did_not_change_has_no_changes() -> None:
    assert register_changes(_entry(), _entry(), TUESDAY) == ()


def test_a_new_registration_number_is_a_registration() -> None:
    renewed = _entry(
        Registration_Number="REG-0045678",
        Registration_Date="14-03-2027",
        Registration_Expiry_Date="13-03-2030",
    )

    assert register_changes(_entry(), renewed, TUESDAY) == (
        replace(
            SEEN_ON_TUESDAY,
            kind="registration",
            change_date=date(2027, 3, 14),
            registered_until=date(2030, 3, 13),
            registration_number="REG-0045678",
        ),
    )


def test_new_dates_under_the_same_registration_number_are_no_change() -> None:
    extended = _entry(Registration_Expiry_Date="13-09-2027")

    assert register_changes(_entry(), extended, TUESDAY) == ()


def test_a_new_cro_number_is_a_provider_change_naming_both_companies() -> None:
    sold = _entry(
        Registration_Provider="Oakfield Care Limited",
        CRO_Registration_Number="512345",
    )

    assert register_changes(_entry(), sold, TUESDAY) == (
        replace(
            SEEN_ON_TUESDAY,
            kind="provider",
            before_text="Springwood Nursing Homes Limited",
            after_text="Oakfield Care Limited",
        ),
    )


def test_a_provider_without_a_cro_number_is_not_named() -> None:
    # Only a company has a CRO number, so a person's name is never kept.
    company = _entry()
    person = _entry(
        Registration_Provider="A Person", CRO_Registration_Number=""
    )

    assert register_changes(company, person, TUESDAY) == (
        replace(
            SEEN_ON_TUESDAY,
            kind="provider",
            before_text="Springwood Nursing Homes Limited",
        ),
    )
    assert register_changes(person, company, TUESDAY) == (
        replace(
            SEEN_ON_TUESDAY,
            kind="provider",
            after_text="Springwood Nursing Homes Limited",
        ),
    )


def test_a_provider_renamed_under_the_same_cro_number_is_no_change() -> None:
    renamed = _entry(Registration_Provider="Springwood Care Limited")

    assert register_changes(_entry(), renamed, TUESDAY) == ()


def test_a_new_centre_name_is_a_name_change() -> None:
    renamed = _entry(Centre_Title="Elm Hall Care Centre")

    assert register_changes(_entry(), renamed, TUESDAY) == (
        replace(
            SEEN_ON_TUESDAY,
            kind="name",
            before_text="Elm Hall Nursing Home",
            after_text="Elm Hall Care Centre",
        ),
    )


def test_a_new_maximum_occupancy_is_a_change_of_beds() -> None:
    smaller = _entry(Maximum_Occupancy="58")

    assert register_changes(_entry(), smaller, TUESDAY) == (
        replace(SEEN_ON_TUESDAY, kind="beds", beds_before=62, beds_after=58),
    )


def test_an_extra_condition_with_a_new_number_was_added() -> None:
    before = _entry(Registration_Conditions=USUAL_THREE)
    after = _entry(
        Registration_Conditions=f"{USUAL_THREE}Condition 4{NO_ADMISSIONS}"
    )

    assert register_changes(before, after, TUESDAY) == (
        replace(
            SEEN_ON_TUESDAY,
            kind="condition_added",
            condition_number=4,
            after_text=NO_ADMISSIONS,
        ),
    )


def test_an_extra_condition_whose_number_is_gone_was_removed() -> None:
    before = _entry(
        Registration_Conditions=f"{USUAL_THREE}Condition 4{NO_ADMISSIONS}"
    )
    after = _entry(Registration_Conditions=USUAL_THREE)

    assert register_changes(before, after, TUESDAY) == (
        replace(
            SEEN_ON_TUESDAY,
            kind="condition_removed",
            condition_number=4,
            before_text=NO_ADMISSIONS,
        ),
    )


def test_an_extra_condition_with_other_words_was_changed() -> None:
    before = _entry(
        Registration_Conditions=f"{USUAL_THREE}Condition 4{NO_ADMISSIONS}"
    )
    after = _entry(
        Registration_Conditions=(
            f"{USUAL_THREE}Condition 4No new residents may be admitted."
        )
    )

    assert register_changes(before, after, TUESDAY) == (
        replace(
            SEEN_ON_TUESDAY,
            kind="condition_changed",
            condition_number=4,
            before_text=NO_ADMISSIONS,
            after_text="No new residents may be admitted.",
        ),
    )


def test_new_words_in_the_usual_three_conditions_are_no_change() -> None:
    before = _entry(Registration_Conditions=USUAL_THREE)
    after = _entry(
        Registration_Conditions=USUAL_THREE.replace(
            "Statement of Purpose.", "Statement of Purpose of 5 May 2026."
        )
    )

    assert register_changes(before, after, TUESDAY) == ()


def test_text_that_differs_only_in_whitespace_is_the_same() -> None:
    before = _entry(
        Centre_Title="Elm Hall  Nursing Home",
        Registration_Conditions=f"{USUAL_THREE}Condition 4{NO_ADMISSIONS}",
        Chief_Inspector_Note=NOTE,
    )
    after = _entry(
        Registration_Conditions=(
            f"{USUAL_THREE}Condition 4"
            + NO_ADMISSIONS.replace("rooms 28", "rooms\t28")
        ),
        Chief_Inspector_Note=NOTE.replace(
            "chief inspector", "chief\ninspector"
        ),
    )

    assert register_changes(before, after, TUESDAY) == ()


def test_a_note_that_is_new_or_reworded_was_added() -> None:
    reworded = "The registered provider has applied to renew the registration."

    assert register_changes(
        _entry(), _entry(Chief_Inspector_Note=NOTE), TUESDAY
    ) == (replace(SEEN_ON_TUESDAY, kind="note_added", after_text=NOTE),)
    assert register_changes(
        _entry(Chief_Inspector_Note=NOTE),
        _entry(Chief_Inspector_Note=reworded),
        TUESDAY,
    ) == (replace(SEEN_ON_TUESDAY, kind="note_added", after_text=reworded),)


def test_a_note_that_is_gone_was_removed() -> None:
    assert register_changes(
        _entry(Chief_Inspector_Note=NOTE), _entry(), TUESDAY
    ) == (replace(SEEN_ON_TUESDAY, kind="note_removed", before_text=NOTE),)


@pytest.mark.parametrize(
    ("fetched_at", "shown_on"),
    [
        # Irish summer time is an hour ahead of UTC, so this is past midnight.
        (datetime(2026, 10, 6, 23, 30, tzinfo=UTC), date(2026, 10, 7)),
        (datetime(2026, 11, 6, 23, 30, tzinfo=UTC), date(2026, 11, 6)),
    ],
)
def test_a_change_is_dated_by_the_irish_day_its_snapshot_was_fetched(
    fetched_at: datetime, shown_on: date
) -> None:
    late = replace(TUESDAY, fetched_at=fetched_at)
    renamed = _entry(Centre_Title="Elm Hall Care Centre")

    (change,) = register_changes(_entry(), renamed, late)

    assert (change.change_date, change.shown_on) == (shown_on, shown_on)
