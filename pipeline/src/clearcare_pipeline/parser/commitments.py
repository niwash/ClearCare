"""Split provider responses at explicit actions and list items."""

import calendar
import re
from dataclasses import dataclass
from datetime import date
from itertools import pairwise

VERSION = "rules-v3"
_ACTION = re.compile(
    r"\b(?:will|shall|plan(?:s|ned)? to|intend(?:s)? to|aim(?:s)? to|"
    r"continue to|is to be|are to be)\b",
    re.IGNORECASE,
)
_ITEM = r"(?:[•●▪\-\u2013]|\d+[.)]|[a-z][.)])\s+"
_SUB_REGULATION = r"\b\d+\s*(?:\([a-z0-9]+\)\s*)+"
# A sentence end is not a boundary after a bare marker such as "2." at
# the start of a line, so the marker stays with its item as a bullet does.
# Lookbehinds are fixed-width, which limits this to one or two digits.
_BOUNDARY = re.compile(
    r"(?<=[.!?;])(?m:(?<!^\d\.)(?<!^\d\d\.)(?<!^[a-z]\.))\s+(?=[A-Z•●▪])|"
    r"\n\s*\n|"
    rf"(?m:^(?={_ITEM}|(?:Regulation\s+)?{_SUB_REGULATION}))"
)
# A Time Frame label line ends its part, so the continuation rule attaches
# only the label and the next line starts afresh. As a _BOUNDARY
# alternative it would consume the line and hide sentence ends within it.
_LABEL_LINE = re.compile(r"^time\s*frame\s*:.*\n", re.IGNORECASE | re.MULTILINE)
_MONTHS = {name.lower(): i for i, name in enumerate(calendar.month_name) if i}
_MONTH = "(?:" + "|".join(_MONTHS) + ")"
_DATE = re.compile(
    rf"\b(?:(?P<day>\d{{1,2}})(?:st|nd|rd|th)?\s+)?"
    rf"(?P<month>{_MONTH})\s+(?P<year>20\d{{2}})\b|"
    r"\b(?P<n_day>\d{1,2})[/.\-](?P<n_month>\d{1,2})"
    r"[/.\-](?P<n_year>20\d{2})\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Commitment:
    """An exact response span, with only the deadline the provider states."""

    start_offset: int
    end_offset: int
    text: str
    sub_regulation: str | None
    stated_deadline: date | None
    stated_deadline_text: str | None
    deadline_precision: str | None


def split(text: str) -> tuple[Commitment, ...]:
    """Keeps context with actions; falls back to the complete response.

    Offsets are zero-based Python character indexes, with an exclusive end.
    Month-only deadlines use the month's last day and retain their precision.
    A dated list introduction applies only to its following bullet items.
    """
    boundaries = sorted(
        {
            0,
            len(text),
            *(m.end() for m in _BOUNDARY.finditer(text)),
            *(m.end() for m in _LABEL_LINE.finditer(text)),
        }
    )
    spans: list[tuple[int, int, tuple[date, str, str] | None]] = []
    start = 0
    detected = False
    shared: tuple[date, str, str] | None = None
    current_deadline: tuple[date, str, str] | None = None
    in_item = False
    for left, right in pairwise(boundaries):
        part = text[left:right].strip()
        if not part:
            continue
        item = re.match(_ITEM, part) is not None
        action = _ACTION.search(part) is not None or item
        continuation = (
            re.match(
                r"(?:This will (?:address|ensure)\b|Time\s*frame\s*:)",
                part,
                re.IGNORECASE,
            )
            is not None
        )
        deadline = _deadline(part) if action or continuation else None
        # A blank line ends list context. A new action on its own line also
        # starts a paragraph; wrapped sentences within an item stay together.
        if re.search(r"\n[ \t]*\n[ \t]*$", text[:left]) or (
            in_item
            and action
            and not item
            and not continuation
            and re.search(r"\n[ \t]*$", text[:left])
        ):
            in_item = False
            shared = None
        # A list introduction is context for its items, not a separate action.
        if part.endswith(":") and deadline:
            shared = deadline
            continue
        if detected and not item and (in_item or continuation):
            current_deadline = current_deadline or deadline
            continue
        if action and detected:
            spans.append((start, left, current_deadline))
            start = left
        if action:
            current_deadline = deadline or (shared if item else None)
            detected = True
            in_item = item
        if not item:
            shared = None
    if not detected:
        return (_commitment(text, 0, len(text), None),)
    spans.append((start, len(text), current_deadline))
    return tuple(
        _commitment(text, start, end, due) for start, end, due in spans
    )


def _commitment(
    text: str,
    start: int,
    end: int,
    deadline: tuple[date, str, str] | None,
) -> Commitment:
    while start < end and text[start].isspace():
        start += 1
    while end > start and text[end - 1].isspace():
        end -= 1
    span = text[start:end]
    provisions = {
        re.sub(r"\s+", "", m[0]) for m in re.finditer(_SUB_REGULATION, span)
    }
    return Commitment(
        start,
        end,
        span,
        next(iter(provisions)) if len(provisions) == 1 else None,
        *(deadline or (None, None, None)),
    )


def _deadline(text: str) -> tuple[date, str, str] | None:
    for match in _DATE.finditer(text):
        prefix = text[: match.start()]
        # Bare 'on' dates often name inspections. Require a deadline cue
        # tied to the action's clause, or an explicit Timeframe label.
        cue = re.search(
            r"\b(?:(?:by|before|within)\s+(?:the\s+)?"
            r"(?:(?:end|end of|end of the)\s+)?|"
            r"(?:will|shall)\s+be\s+completed\s+on\s+|time\s*frame\s*:\s*)$",
            prefix,
            re.IGNORECASE,
        )
        clause = re.split(r"[.!?;]", prefix)[-1]
        if cue is None or not (
            _ACTION.search(clause)
            or re.match(_ITEM, clause.lstrip())
            or re.sub(r"\s+", "", cue[0]).lower().startswith("timeframe")
        ):
            continue
        if match["n_year"]:
            year, month, day = (
                int(match[f"n_{key}"]) for key in ("year", "month", "day")
            )
            precision = "day"
        else:
            year = int(match["year"])
            month = _MONTHS[match["month"].lower()]
            day = (
                int(match["day"])
                if match["day"]
                else calendar.monthrange(year, month)[1]
            )
            precision = "day" if match["day"] else "month"
        try:
            return date(year, month, day), match[0], precision
        except ValueError:
            continue
    return None
