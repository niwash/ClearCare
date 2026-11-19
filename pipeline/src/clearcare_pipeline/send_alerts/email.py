"""What the dispatcher emails, and what it emails through.

The dispatcher composes one digest per account and hands it to a sender. The
sender is a seam: today it holds the log sender, which writes the email to
the stage's log and returns a fake id, so the whole flow runs with no AWS at
all; the SES sender joins it with CCARE-268, and the stage's code is the
same either way. The email itself is two parts, an HTML body where the
targets are clickable text and a plain-text fallback where each line spells
its address out.

No log line carries a recipient's address (ADR-0034): the senders log the
subject and the body, and the dispatcher's own lines name the account by its
row id and the message id, never the address.
"""

import logging
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from html import escape
from itertools import count
from typing import Protocol

from clearcare_pipeline.send_alerts.settings import Links

logger = logging.getLogger(__name__)

SUBJECT = "New inspection reports published | ClearCare"

Entry = Mapping[str, object]
Sections = Mapping[str, Sequence[Entry]]
Items = list[tuple[str, str]]


class EmailSender(Protocol):
    """What a digest is handed to; returns the provider's message id."""

    def send(self, to: str, subject: str, text: str, html: str) -> str:
        """Sends one email and returns the provider's message id."""
        ...


class LogSender:
    """The sender without AWS: writes the email to the log, sends nothing.

    This is the stand-in the tests and a development compose run use. The
    message ids it returns count, so a log can be followed through a pass.
    """

    def __init__(self) -> None:
        """Counts the fake ids from one."""
        self._ids = count(1)

    def send(self, to: str, subject: str, text: str, html: str) -> str:
        """Logs the email and returns a fake message id.

        The log carries the subject and the plain-text body, and no
        address, as ADR-0034 fixes; the caller's own lines name the
        account by id.
        """
        del to, html
        message_id = f"log-{next(self._ids):06d}"
        logger.info(
            "would send email %s\nsubject: %s\n%s", message_id, subject, text
        )
        return message_id


@dataclass(frozen=True)
class Names:
    """The names behind the ids a digest carries, resolved before composing.

    A centre without a name is one the register has not loaded; its line
    spells the HIQA id, so the email is never wrong about that.
    """

    centres: Mapping[str, str | None]
    counties: Mapping[int, str]


def compose(
    metadata: Sections, names: Names, links: Links, unsubscribe_url: str
) -> tuple[str, str]:
    """Composes one digest as a (plain text, HTML) pair.

    The metadata is the sections one email covers: per kind, the entries
    the account's receipts carried. Each kind becomes a section, each
    distinct target one line, so a target several ingest runs touched is
    named once. A kind the email does not cover is left out, and the
    all-reports section, whose receipts name no target, reads as the
    generic line.
    """
    centre_items = _centre_items(metadata.get("CENTRE") or (), names, links)
    county_items = _county_items(metadata.get("COUNTY") or (), names, links)
    follows_all = "ALL" in metadata
    intro = _intro(centre_items, county_items, follows_all)
    across = _across_line(centre_items, county_items, follows_all)
    return (
        _text(
            centre_items, county_items, across, intro, links, unsubscribe_url
        ),
        _html(
            centre_items,
            county_items,
            across,
            intro,
            links,
            unsubscribe_url,
            names,
        ),
    )


def _intro(centre_items: Items, county_items: Items, follows_all: bool) -> str:
    """The sentence that says what this digest matched, or '' for all-only.

    An all-reports-only digest carries no matching sentence: the greeting
    and the across-Ireland section already say what happened.
    """
    kinds = [
        kind
        for kind, items in (
            ("nursing homes", centre_items),
            ("counties", county_items),
        )
        if items
    ]
    if not kinds:
        return ""
    matching = " and ".join(kinds)
    sentence = f"We've found new reports matching the {matching} you follow"
    if follows_all:
        sentence += ", as well as new publications across the site"
    return sentence + "."


def _across_line(
    centre_items: Items, county_items: Items, follows_all: bool
) -> str | None:
    """The across-Ireland paragraph, or None when the kind is not covered."""
    if not follows_all:
        return None
    if centre_items or county_items:
        return (
            "New inspection reports have also been published across other"
            " areas."
        )
    return "New inspection reports have been published across the site."


def _centre_items(
    entries: Sequence[Entry], names: Names, links: Links
) -> Items:
    """The centre links, first seen first, each once."""
    return [
        (_centre_name(centre_id, names), links.centre_inspections(centre_id))
        for centre_id in _distinct(_centre_ids(entries))
    ]


def _county_items(
    entries: Sequence[Entry], names: Names, links: Links
) -> Items:
    """The county links, first seen first, each once."""
    items: Items = []
    for county_id in _distinct(_county_ids(entries)):
        name = names.counties.get(county_id)
        # A county id the table does not hold cannot be named or linked;
        # the ingest only writes ids it resolved there, so this is a shape
        # to log about where the receipt is written, not one to render.
        if name is not None:
            items.append((name, links.county(name)))
    return items


def _centre_name(centre_id: str, names: Names) -> str:
    name = names.centres.get(centre_id)
    return name if name is not None else f"centre {centre_id}"


def _centre_ids(entries: Iterable[Entry]) -> Iterable[str]:
    for entry in entries:
        centre_id = entry.get("centre_id")
        if centre_id is not None:
            yield str(centre_id)


def _county_ids(entries: Iterable[Entry]) -> Iterable[int]:
    for entry in entries:
        county_id = entry.get("county_id")
        if isinstance(county_id, int):
            yield county_id


def _distinct[T](values: Iterable[T]) -> list[T]:
    """First seen first, each once, order kept."""
    seen: dict[T, None] = {}
    for value in values:
        seen.setdefault(value, None)
    return list(seen)


def _text(
    centre_items: Items,
    county_items: Items,
    across: str | None,
    intro: str,
    links: Links,
    unsubscribe_url: str,
) -> str:
    """The plain-text fallback: each target names its address in full."""
    blocks: list[str] = [
        "Hi,",
        "There are new inspection reports available on ClearCare.",
    ]
    if intro:
        blocks.append(intro)
    if centre_items:
        blocks.append("Reports from centres you follow")
        blocks.append(
            "\n\n".join(f"{name}: {url}" for name, url in centre_items)
        )
    if county_items:
        blocks.append("Reports from counties you follow")
        blocks.append(
            "\n\n".join(f"{name}: {url}" for name, url in county_items)
        )
    if across is not None:
        blocks.append("New reports across Ireland")
        blocks.append(across)
        # The all-reports section carries no links of its own, so this is
        # where the email gives its reader somewhere to go; a digest of
        # centres and counties is already all links.
        blocks.append("Stay informed")
        blocks.append(
            "Visit ClearCare to explore the latest inspection reports and see"
            f" what's been published: {links.search_all()}"
        )
    blocks.append(
        "You're receiving this email because you've subscribed to new"
        " inspection report alerts on ClearCare."
    )
    blocks.append(f"Unsubscribe from all alerts: {unsubscribe_url}")
    blocks.append("Thanks,\nThe ClearCare Team")
    return "\n\n".join(blocks)


def _html(
    centre_items: Items,
    county_items: Items,
    across: str | None,
    intro: str,
    links: Links,
    unsubscribe_url: str,
    names: Names,
) -> str:
    """The HTML part: the same digest, the targets as clickable text."""
    blocks: list[str] = [
        "<p>Hi,</p>",
        "<p>There are new inspection reports available on ClearCare.</p>",
    ]
    if intro:
        blocks.append(f"<p>{escape(intro)}</p>")
    if centre_items:
        blocks.append("<p><strong>Reports from centres you follow</strong></p>")
        blocks.extend(_anchor(item) for item in centre_items)
    if county_items:
        blocks.append(
            "<p><strong>Reports from counties you follow</strong></p>"
        )
        blocks.extend(_anchor(item) for item in county_items)
    if across is not None:
        blocks.append("<p><strong>New reports across Ireland</strong></p>")
        blocks.append(f"<p>{escape(across)}</p>")
        # The all-reports section carries no links of its own, so this is
        # where the email gives its reader somewhere to go; a digest of
        # centres and counties is already all links.
        blocks.append("<p><strong>Stay informed</strong></p>")
        blocks.append(
            _anchor(
                (
                    "Visit ClearCare to explore the latest inspection reports"
                    " and see what's been published.",
                    links.search_all(),
                )
            )
        )
    blocks.append(
        "<p>You're receiving this email because you've subscribed to new"
        " inspection report alerts on ClearCare.</p>"
    )
    blocks.append(
        f'<p><a href="{escape(unsubscribe_url, quote=True)}">'
        "Unsubscribe from all alerts</a></p>"
    )
    blocks.append("<p>Thanks,<br>The ClearCare Team</p>")
    return "<html><body>" + "".join(blocks) + "</body></html>"


def _anchor(item: tuple[str, str]) -> str:
    """One clickable-text paragraph: the name anchored to its address."""
    name, url = item
    return f'<p><a href="{escape(url, quote=True)}">{escape(name)}</a></p>'
