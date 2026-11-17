# The conditions of registration of nine centres, as HIQA printed them on the
# register of 12 November 2026 (fixtures/conditions.json, by centre ID).

import json
from pathlib import Path

import pytest

from clearcare_pipeline.load_register.conditions import (
    Condition,
    extra_conditions,
    split_conditions,
)

PRINTED: dict[str, str] = json.loads(
    (Path(__file__).parent / "fixtures" / "conditions.json").read_text("utf-8")
)
USUAL_1 = (
    "Subject to any prohibitions or restrictions contained in any other"
    " condition(s), the designated centre shall be operated at all times in"
    " accordance with the Statement of Purpose within the footprint of the"
    " designated centre on the floor plan received on 27 April 2026. The"
    " registered provider shall only provide for the specific care and"
    " support needs, and services, within the facilities as set out the"
    " Statement of Purpose, as agreed with the Chief Inspector at the time of"
    " registration. Any changes to the specific care and support needs and"
    " services provided must be agreed in advance with the Chief Inspector."
)
USUAL_2 = (
    "Only persons aged 18 years or older shall be accommodated at the"
    " designated centre at any time."
)
MAXIMUM = (
    "The maximum number of persons that may be accommodated at the"
    " designated centre is"
)


def _numbers(conditions: tuple[Condition, ...]) -> list[int]:
    return [condition.number for condition in conditions]


def test_conditions_are_split_at_their_numbers() -> None:
    # HIQA runs each marker into the words around it: "...Chief
    # Inspector.Condition 2Only persons...", with two spaces after a comma.
    assert split_conditions(PRINTED["1"]) == (
        Condition(1, USUAL_1),
        Condition(2, USUAL_2),
        Condition(3, f"{MAXIMUM}: 27."),
    )


def test_a_condition_named_inside_another_does_not_start_one() -> None:
    # Centre 252's condition 3 ends "...compliance with Condition 4." and
    # condition 4 starts straight after it.
    conditions = split_conditions(PRINTED["252"])

    assert _numbers(conditions) == [1, 2, 3, 4]
    assert conditions[2].text == (
        f"{MAXIMUM}: 61, reducing to 58 on achieving compliance with"
        " Condition 4."
    )
    assert conditions[3].text.startswith("Rooms 27, 28 and 30 will reduce")


# Centre 346's conditions in the snapshots before 3 October 2026 name a
# condition inside a sentence in two places. Each test sets HIQA's words
# around one place into the usual conditions; "..." marks words left out.
def test_a_condition_that_names_itself_does_not_start_again() -> None:
    condition_5 = (
        "At a minimum the registered provider ... set out in points 1 and 2"
        " of this Condition 5 exclude any additional contracted and/or agreed"
        " one to one care hours."
    )
    printed = (
        f"Condition 1 {USUAL_1}Condition 2{USUAL_2}Condition 3{MAXIMUM}: 27."
        f"Condition 5{condition_5}"
    )

    conditions = split_conditions(printed)

    assert _numbers(conditions) == [1, 2, 3, 5]
    assert conditions[3] == Condition(5, condition_5)


def test_a_condition_named_at_the_end_of_its_own_text_stays_whole() -> None:
    condition_1 = "Subject to ... the Chief Inspector to vary Condition 1."
    printed = (
        f"Condition 1 {condition_1}Condition 2{USUAL_2}"
        f"Condition 3{MAXIMUM}: 27."
    )

    assert split_conditions(printed) == (
        Condition(1, condition_1),
        Condition(2, USUAL_2),
        Condition(3, f"{MAXIMUM}: 27."),
    )


# As centres 316, 398 and 652 print condition 4, and centre 9130 its own.
@pytest.mark.parametrize(
    "marker", ["Condition 4 ", "Condition 4: ", "Condition 4:", "Condition 4"]
)
def test_a_marker_ends_where_the_capital_letter_of_its_words_starts(
    marker: str,
) -> None:
    printed = f"Condition 2{USUAL_2}{marker}The registered provider shall."

    assert split_conditions(printed)[1] == Condition(
        4, "The registered provider shall."
    )


def test_a_number_with_two_markers_is_one_condition() -> None:
    # No register text has done this so far. The loader stores one extra for
    # each number, so two with the same number would fail its insert and stop
    # the register load.
    printed = (
        f"Condition 2{USUAL_2}Condition 4No new residents may be admitted."
        "Condition 4Rooms 28 and 29 are single rooms."
    )

    assert split_conditions(printed) == (
        Condition(2, f"{USUAL_2}Condition 4No new residents may be admitted."),
        Condition(4, "Rooms 28 and 29 are single rooms."),
    )


def test_text_without_a_numbered_condition_has_none() -> None:
    assert split_conditions("") == ()
    assert split_conditions(USUAL_2) == ()


def test_numbers_may_skip() -> None:
    assert _numbers(split_conditions(PRINTED["614"])) == [1, 2, 3, 5, 6]


def test_a_colon_after_the_number_is_not_part_of_the_text() -> None:
    # As centres 503 and 9130 print it.
    printed = f"Condition 1 {USUAL_1}Condition 6:By 31 December 2025."

    assert split_conditions(printed)[1] == Condition(6, "By 31 December 2025.")


def test_whitespace_inside_a_condition_is_collapsed() -> None:
    # Centre 309's condition 4 is a list with tabs after its letters.
    text = split_conditions(PRINTED["309"])[3].text

    assert "evidenced by:a. Effective supervision of all aspects" in text
    assert "centre, including appropriate governance, supervision," in text


@pytest.mark.parametrize("centre_id", ["1", "715", "569"])
def test_the_usual_three_conditions_have_no_extras(centre_id: str) -> None:
    assert extra_conditions(PRINTED[centre_id]) == ()


@pytest.mark.parametrize(
    ("centre_id", "numbers"),
    [("309", [4, 5]), ("614", [5, 6]), ("594", [5]), ("5702", [4])],
)
def test_every_condition_from_the_fourth_is_an_extra(
    centre_id: str, numbers: list[int]
) -> None:
    assert _numbers(extra_conditions(PRINTED[centre_id])) == numbers


def test_an_extra_keeps_its_number_and_its_text() -> None:
    assert extra_conditions(PRINTED["614"]) == (
        Condition(
            5,
            "The physical environment in the designated centre must be"
            " reconfigured as outlined in the plans submitted to the Chief"
            " Inspector on 14 June 2024 to comply with Regulations 17 and 9"
            " by 15 July 2025.",
        ),
        Condition(
            6,
            "In order to comply with Regulation 28; Fire Precautions of the"
            " Health Act 2007 (Care and Welfare of Residents in Designated"
            " Centres for Older People) Regulations 2013, the registered"
            " provider shall address • All orange rated fire risks by 31 May"
            " 2025.",
        ),
    )


def test_condition_3_that_says_more_than_the_maximum_is_an_extra() -> None:
    assert extra_conditions(PRINTED["252"])[0] == Condition(
        3,
        f"{MAXIMUM}: 61, reducing to 58 on achieving compliance with"
        " Condition 4.",
    )
    assert extra_conditions(PRINTED["395"]) == (
        Condition(
            3,
            f"{MAXIMUM}: 70 reducing to 67 on achieving compliance with"
            " Condition 4.",
        ),
        Condition(
            4,
            "No new residents may be admitted to or existing residents may be"
            " transferred into rooms 28, 29 and 48 until such time as these"
            " rooms have been reconfigured from three bedded to twin bedded"
            " rooms.",
        ),
    )


# HIQA does not always write the sentence the same way. The first five are
# centres 1, 614, 594, 382 and 206; the last is centre 5's, with a space
# before the full stop.
@pytest.mark.parametrize(
    "condition_3",
    [
        f"{MAXIMUM}: 27.",
        f"{MAXIMUM}: [30].",
        f"{MAXIMUM}: 101",
        f"{MAXIMUM} 42.",
        f"{MAXIMUM}:63.",
        f"{MAXIMUM}: 41 .",
    ],
)
def test_condition_3_that_only_gives_the_maximum_is_not_an_extra(
    condition_3: str,
) -> None:
    printed = f"Condition 1 {USUAL_1}Condition 2{USUAL_2}Condition 3"

    assert extra_conditions(printed + condition_3) == ()


def test_a_caveat_inside_condition_1_is_not_an_extra() -> None:
    # Centre 309's condition 1 leaves out 21 beds on the first floor.
    conditions = split_conditions(PRINTED["309"])

    assert "excluding the use of 21 beds" in conditions[0].text
    assert _numbers(extra_conditions(PRINTED["309"])) == [4, 5]
