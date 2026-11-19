"""One dispatch pass, from claimed events to sent emails (CCARE-267).

The pass is the same shape whatever the deployment: requeue what a stopped
run left claimed, claim a batch of events, and either consume them silently
(the gate is closed) or match them to subscriptions, write the receipts that
owe an email, and send one digest per account, each with up to three
attempts. The send loop's sleeps and the attempt cap are injected, so tests
run without waiting and without a ceiling.
"""

import logging
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass

from clearcare_pipeline.send_alerts.cognito import Addresses
from clearcare_pipeline.send_alerts.database import (
    ATTEMPT_CAP,
    Events,
    Receipt,
)
from clearcare_pipeline.send_alerts.email import (
    SUBJECT,
    EmailSender,
    Names,
    compose,
)
from clearcare_pipeline.send_alerts.settings import Links

logger = logging.getLogger(__name__)

# Pauses between a digest's attempts: before the second, then the third.
# A pass shares one budget for these, so a long outage cannot stretch a
# pass into hours; once spent, the remaining attempts run back to back.
BACKOFF_SECONDS = (30.0, 120.0)
BACKOFF_BUDGET_SECONDS = 600.0

# Attempts per pass, of the cap across passes (database.ATTEMPT_CAP).
ATTEMPTS_PER_PASS = 3


@dataclass(frozen=True)
class Summary:
    """What one dispatch pass did."""

    requeued: int
    claimed: int
    events_processed: int
    receipts_owed: int
    emails_sent: int
    emails_failed: int
    receipts_skipped: int
    events_left: int


def dispatch(
    events: Events,
    sender: EmailSender | None,
    addresses: Addresses | None,
    links: Links | None,
    sleep: Callable[[float], None] = time.sleep,
) -> Summary:
    """Runs one pass against the database.

    ``sender``, ``addresses`` and ``links`` are the sending side: all three
    are None when the gate is closed, and the pass stops after consuming
    the claimed events, owing nothing.
    """
    requeued = events.requeue_processing()
    claimed = events.claim()
    event_ids = [event.id for event in claimed]
    if sender is None or addresses is None or links is None:
        logger.info(
            "sending is off (%s is off); %d events consumed without receipts",
            "CLEARCARE_ALERTS",
            len(event_ids),
        )
        events.consume([], event_ids)
        return Summary(
            requeued=requeued,
            claimed=len(event_ids),
            events_processed=len(event_ids),
            receipts_owed=0,
            emails_sent=0,
            emails_failed=0,
            receipts_skipped=0,
            events_left=events.unclaimed_events(),
        )
    matches = events.match(event_ids) if claimed else []
    receipts_owed = events.consume(matches, event_ids) if claimed else 0
    # The receipts are the pass's real work list: this pass's new matches
    # and the failed sends of earlier passes alike, so a pass with no
    # events to claim still sends what is owed.
    receipts = events.owed_receipts()
    sent = failed = skipped = 0
    if receipts:
        budget = _Backoff(sleep)
        names = _names(events, receipts)
        for user_id, user_receipts in _by_user(receipts).items():
            outcome = _send_user(
                events,
                sender,
                addresses,
                links,
                budget,
                user_id,
                user_receipts,
                names,
            )
            sent += outcome.sent
            failed += outcome.failed
            skipped += outcome.skipped_receipts
    elif not claimed:
        logger.info("no unprocessed events and nothing owed; nothing to do")
    return Summary(
        requeued=requeued,
        claimed=len(event_ids),
        events_processed=len(event_ids),
        receipts_owed=receipts_owed,
        emails_sent=sent,
        emails_failed=failed,
        receipts_skipped=skipped,
        events_left=events.unclaimed_events(),
    )


@dataclass(frozen=True)
class _Outcome:
    """What sending to one account did: one email, or none, and why."""

    sent: int = 0
    failed: int = 0
    skipped_receipts: int = 0


def _by_user(receipts: Sequence[Receipt]) -> dict[int, list[Receipt]]:
    groups: dict[int, list[Receipt]] = {}
    for receipt in receipts:
        groups.setdefault(receipt.user_id, []).append(receipt)
    return groups


class _Backoff:
    """The pass's shared budget of pauses between send attempts."""

    def __init__(self, sleep: Callable[[float], None]) -> None:
        self._sleep = sleep
        self._left = BACKOFF_BUDGET_SECONDS

    def pause(self, after_attempt: int) -> None:
        """Waits the pause due before the next attempt, within the budget.

        ``after_attempt`` counts from 1: the first attempt's failure waits
        the first pause. A pause the budget cannot afford is skipped, so a
        long outage costs one pass minutes, not hours.
        """
        index = min(after_attempt, len(BACKOFF_SECONDS)) - 1
        seconds = BACKOFF_SECONDS[max(index, 0)]
        if seconds <= 0 or self._left <= 0:
            return
        seconds = min(seconds, self._left)
        self._left -= seconds
        self._sleep(seconds)


def _names(events: Events, receipts: Sequence[Receipt]) -> Names:
    """The names behind every id the pass's digests carry, asked once."""
    centre_ids: list[str] = []
    county_ids: list[int] = []
    for receipt in receipts:
        centre_id = receipt.metadata.get("centre_id")
        if centre_id is not None:
            centre_ids.append(str(centre_id))
        county_id = receipt.metadata.get("county_id")
        if isinstance(county_id, int):
            county_ids.append(county_id)
    centres, counties = events.names(centre_ids, county_ids)
    return Names(centres=centres, counties=counties)


def _sections(
    receipts: Sequence[Receipt],
) -> dict[str, list[dict[str, object]]]:
    """Groups the flat receipts into the digest's sections.

    The metadata's own keys say which section a row belongs to: a
    ``centre_id`` alone is a centre row, a ``county_id`` alone a county
    row, and the empty object the all-reports row, whose section carries
    no entries and reads as the generic line.
    """
    sections: dict[str, list[dict[str, object]]] = {}
    for receipt in receipts:
        entry = receipt.metadata
        if not entry:
            sections.setdefault("ALL", [])
        elif "county_id" not in entry:
            sections.setdefault("CENTRE", []).append(entry)
        elif "centre_id" not in entry:
            sections.setdefault("COUNTY", []).append(entry)
        else:
            logger.warning("a receipt names both keys; left out of the email")
    return sections


def _send_user(
    events: Events,
    sender: EmailSender,
    addresses: Addresses,
    links: Links,
    budget: _Backoff,
    user_id: int,
    receipts: Sequence[Receipt],
    names: Names,
) -> _Outcome:
    """Sends one account's digest, with the attempts a pass allows.

    The pass's rows are grouped into sections in memory, so the email
    covers every ingest run the account is still owed, however many
    attempts those have had before this pass. An account Cognito cannot
    resolve is skipped, never retried; a send that keeps failing is marked
    failed with its attempt count, and the attempt cap, reached across
    passes, ends it.
    """
    receipt_ids = [receipt.id for receipt in receipts]
    sections = _sections(receipts)
    if not sections:
        logger.warning(
            "receipts for user %d name no target; marked skipped", user_id
        )
        events.mark_skipped(receipt_ids)
        return _Outcome(skipped_receipts=len(receipt_ids))
    cognito_sub = events.cognito_sub(user_id)
    if cognito_sub is None:
        logger.warning("no account row for user %d; receipts skipped", user_id)
        events.mark_skipped(receipt_ids)
        return _Outcome(skipped_receipts=len(receipt_ids))
    address: str | None = None
    for attempt in range(1, ATTEMPTS_PER_PASS + 1):
        try:
            resolved = addresses.address(cognito_sub)
            if resolved is None:
                logger.warning(
                    "no address for user %d; receipts skipped and never"
                    " retried",
                    user_id,
                )
                events.mark_skipped(receipt_ids)
                return _Outcome(skipped_receipts=len(receipt_ids))
            address = resolved
            break
        except Exception as error:
            logger.warning(
                "attempt %d for user %d could not resolve the address: %s",
                attempt,
                user_id,
                error,
            )
            if attempt < ATTEMPTS_PER_PASS:
                budget.pause(attempt)
    if address is None:
        events.mark_failed(receipt_ids, ATTEMPTS_PER_PASS, ATTEMPT_CAP)
        return _Outcome(failed=1)
    unsubscribe_url = links.unsubscribe(events.unsubscribe_token(user_id))
    text, html = compose(sections, names, links, unsubscribe_url)
    for attempt in range(1, ATTEMPTS_PER_PASS + 1):
        try:
            message_id = sender.send(address, SUBJECT, text, html)
        except Exception as error:
            logger.warning(
                "attempt %d to email user %d failed: %s",
                attempt,
                user_id,
                error,
            )
            if attempt < ATTEMPTS_PER_PASS:
                budget.pause(attempt)
            continue
        events.mark_sent(receipt_ids)
        logger.info(
            "emailed user %d about %d receipts as message %s",
            user_id,
            len(receipt_ids),
            message_id,
        )
        return _Outcome(sent=1)
    events.mark_failed(receipt_ids, ATTEMPTS_PER_PASS, ATTEMPT_CAP)
    return _Outcome(failed=1)
