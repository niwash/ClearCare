"""Splitting a centre's conditions of registration and picking the extras."""

import re
from dataclasses import dataclass

# A condition starts at "Condition", its number and the capital letter of its
# first word. HIQA runs the marker into the words around it ("...Chief
# Inspector.Condition 2Only persons..."), sometimes with a space or a colon
# after the number. A condition named inside a sentence is followed by a full
# stop or a lower-case word ("...compliance with Condition 4.", "...of this
# Condition 5 exclude..."), so it does not start one.
_MARKER = re.compile(r"Condition\s*([0-9]+):?\s*(?=[A-Z])")
# Condition 3 of nearly every centre, once whitespace is collapsed. HIQA
# writes it with and without the colon, the full stop and square brackets.
_ONLY_THE_MAXIMUM = re.compile(
    r"The maximum number of persons that may be accommodated at the"
    r" designated centre is ?:? ?\[?[0-9]+\]? ?\.?"
)


@dataclass(frozen=True)
class Condition:
    """One numbered condition of registration, whitespace collapsed."""

    number: int
    text: str


def collapse_whitespace(text: str) -> str:
    """Returns the text with each run of whitespace as one space."""
    return " ".join(text.split())


def split_conditions(text: str) -> tuple[Condition, ...]:
    """Returns the numbered conditions of the register's column, in order.

    A condition starts at "Condition", its number and the capital letter of
    its first word, and runs to the next such place. Numbers may skip. A
    condition named inside a sentence does not start one: condition 3 of
    centres 252 and 395 ends "...compliance with Condition 4.".

    Each number is returned once. If a number has two markers, the later one
    starts its condition and the earlier one stays in the text before it.
    """
    # No text has repeated a number so far. The loader stores one extra
    # condition for each number (db/V21), so two with the same number would
    # fail its insert and stop the register load.
    last_marker = {int(m.group(1)): m for m in _MARKER.finditer(text)}
    markers = sorted(last_marker.values(), key=lambda marker: marker.start())
    starts = [marker.start() for marker in markers] + [len(text)]
    return tuple(
        Condition(
            number=int(marker.group(1)),
            text=collapse_whitespace(text[marker.end() : end]),
        )
        for marker, end in zip(markers, starts[1:], strict=True)
    )


def extra_conditions(text: str) -> tuple[Condition, ...]:
    """Returns the conditions beyond the three nearly every centre has.

    Those are every condition numbered 4 or more, and condition 3, whole,
    when it says more than the maximum number of residents. Conditions 1 and
    2 are never extras, whatever caveat condition 1 carries.
    """
    return tuple(
        condition
        for condition in split_conditions(text)
        if condition.number >= 4
        or (
            condition.number == 3
            and not _ONLY_THE_MAXIMUM.fullmatch(condition.text)
        )
    )
