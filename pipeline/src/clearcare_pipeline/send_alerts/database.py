"""Reading and writing the alert tables, as ``clearcare_pipeline``.

One pass of the dispatcher is, in order:

* stale ``processing`` events are requeued to ``pending`` (the crash marker,
  ADR-0034: a claim nobody finished is somebody else's work to redo),
* a batch of ``pending`` and ``failed`` events is claimed as ``processing``,
* the claimed events are matched against the active subscriptions, whose
  target the event's metadata must contain and which must already have
  existed when the event was written (alerts start when you subscribe),
* the matches become receipt rows, one per matched target the account's
  subscriptions covered (the all-reports kind one empty-object row per
  account), and the claimed events are marked ``processed`` in the same
  transaction, so an event is never left without the receipts that owe
  its email,
* the unsent receipts (owed email) are sent, one digest per account, each
  with up to three attempts; receipts exhaust to ``failed`` and, after the
  attempt cap, ``skipped``.

The gate (``CLEARCARE_ALERTS``) only shortens this: closed, the pass stops
after the claimed events are marked processed, and no receipt is written, so
nothing is owed and nothing sends. The stage reads only the database, so a
manual ``python -m clearcare_pipeline.send_alerts`` runs without the run
lock (ADR-0022): do not run it beside a live pipeline pass, or a digest can
double-send and an event can be marked processed while its ingest is still
writing batches. The scheduler always runs it under the lock.
"""

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Protocol

import psycopg
from psycopg.rows import TupleRow
from psycopg.types.json import Jsonb

logger = logging.getLogger(__name__)

Connection = psycopg.Connection[TupleRow]

# How many events one pass claims, so a first pass after seeding cannot run
# for hours; the rest wait for the next pass, and the stage exits retry.
CLAIM_LIMIT = 500

# The receipt statuses a pass owes an email for, and the attempt ceiling
# across passes: three attempts per pass, give up entirely at nine.
UNSENT_STATUSES = ("pending", "failed")
ATTEMPT_CAP = 9


@dataclass(frozen=True)
class ClaimedEvent:
    """One event a pass claimed, with what it names."""

    id: int
    package_id: int
    scope: str
    task_uuid: str
    metadata: list[dict[str, Any]]


@dataclass(frozen=True)
class Match:
    """One subscription matched by one event: what the account is told.

    ``entries`` is what the receipt records, the subscription's own target
    for the centre and county kinds and the event's whole list for the
    all-reports kind (whose subscription names no target of its own).
    """

    user_id: int
    task_uuid: str
    scope: str
    entries: list[dict[str, Any]]


@dataclass(frozen=True)
class Receipt:
    """One receipt a pass owes an email for.

    The metadata is flat: it names the one target the row records, and is
    the empty object for the all-reports kind.
    """

    id: int
    user_id: int
    task_uuid: str
    metadata: dict[str, object]
    retry_count: int


class Events(Protocol):
    """The alert tables, as the pass reads and writes them.

    The protocol is what the run needs; Dispatcher is how a real pass
    reaches them, and the tests stand in with fakes.
    """

    def requeue_processing(self) -> int:
        """Requeues the events a stopped run left claimed."""
        ...

    def claim(self, limit: int = CLAIM_LIMIT) -> list[ClaimedEvent]:
        """Claims a batch of unprocessed events and returns what they name."""
        ...

    def match(self, event_ids: Sequence[int]) -> list[Match]:
        """The subscriptions the claimed events name."""
        ...

    def consume(
        self, matches: Sequence[Match], event_ids: Sequence[int]
    ) -> int:
        """Writes the receipts and marks the claimed events processed."""
        ...

    def owed_receipts(self) -> list[Receipt]:
        """The receipts still owed an email, oldest first."""
        ...

    def still_subscribed(self, receipt_ids: Sequence[int]) -> list[int]:
        """The receipt rows an active subscription still covers."""
        ...

    def mark_sent(self, receipt_ids: Sequence[int]) -> None:
        """Records the receipts one email covered as sent."""
        ...

    def mark_skipped(self, receipt_ids: Sequence[int]) -> None:
        """Records receipts that will never email as skipped."""
        ...

    def mark_failed(
        self, receipt_ids: Sequence[int], attempts: int, cap: int
    ) -> None:
        """Records the attempts on receipts a pass could not email."""
        ...

    def cognito_sub(self, user_id: int) -> str | None:
        """The account's Cognito subject."""
        ...

    def unsubscribe_token(self, user_id: int) -> str:
        """The account's signed-out unsubscribe token."""
        ...

    def names(
        self, centre_ids: Sequence[str], county_ids: Sequence[int]
    ) -> tuple[dict[str, str | None], dict[int, str]]:
        """The display names behind the ids the digests carry."""
        ...

    def unclaimed_events(self) -> int:
        """How many events wait beyond this pass's claim."""
        ...


class Dispatcher:
    """The pass's queries, one class so the run reads top to bottom."""

    def __init__(self, connection: Connection) -> None:
        """Creates a pass over one connection."""
        self._connection = connection

    def requeue_processing(self) -> int:
        """Requeues events left claimed by a run that never finished.

        The run lock (ADR-0022) means no other dispatcher is claiming while
        this one runs, so every ``processing`` row found here is abandoned
        work; its emails, if any were sent, are remembered by the sent
        receipts and are not sent twice.
        """
        with (
            self._connection.transaction(),
            self._connection.cursor() as cursor,
        ):
            requeued = cursor.execute(
                "UPDATE clearcare.alert_events SET status = 'pending'"
                " WHERE status = 'processing' AND processed_at IS NULL"
            ).rowcount
        assert requeued is not None
        if requeued:
            logger.info(
                "requeued %d events left claimed by a stopped run", requeued
            )
        return requeued

    def claim(self, limit: int = CLAIM_LIMIT) -> list[ClaimedEvent]:
        """Claims a batch of unprocessed events and returns what they name.

        One statement: the claim is the same snapshot as the read, so no
        other pass can claim between them. Failed events are claimed again:
        the status means the event's pass once failed, not that it is done.
        """
        with self._connection.cursor() as cursor:
            claimed = cursor.execute(
                "WITH due AS ("
                "  SELECT id FROM clearcare.alert_events"
                "  WHERE processed_at IS NULL"
                "    AND status IN ('pending', 'failed')"
                "  ORDER BY created_at, id LIMIT %s"
                "), claimed AS ("
                "  UPDATE clearcare.alert_events e"
                "  SET status = 'processing'"
                "  FROM due WHERE e.id = due.id"
                "  RETURNING e.id, e.alert_package_id, e.task_uuid, e.metadata"
                ")"
                " SELECT c.id, c.alert_package_id, p.scope, c.task_uuid,"
                " c.metadata"
                " FROM claimed c"
                " JOIN clearcare.alert_packages p ON p.id = c.alert_package_id"
                " ORDER BY c.id",
                (limit,),
            ).fetchall()
        return [
            ClaimedEvent(
                id=row[0],
                package_id=row[1],
                scope=str(row[2]),
                task_uuid=str(row[3]),
                metadata=row[4],
            )
            for row in claimed
        ]

    def match(self, event_ids: Sequence[int]) -> list[Match]:
        """The subscriptions the claimed events name.

        An event matches a subscription of the same package whose target the
        event's metadata contains, written jsonb so key order and whitespace
        do not matter, and only if the subscription existed when the event
        did: alerts start when you subscribe, which is also what keeps a
        rebuilt database's backlog from reaching anyone.
        """
        if not event_ids:
            return []
        with self._connection.cursor() as cursor:
            rows = cursor.execute(
                "SELECT s.user_id, e.task_uuid, p.scope, s.metadata, e.metadata"
                " FROM clearcare.alert_events e"
                " JOIN clearcare.alert_packages p"
                "   ON p.id = e.alert_package_id AND p.is_active"
                " JOIN clearcare.alert_subscriptions s"
                "   ON s.alert_package_id = e.alert_package_id"
                "  AND s.is_active"
                "  AND e.created_at >= s.created_at"
                "  AND e.metadata @> s.metadata"
                " WHERE e.id = ANY(%s)"
                " ORDER BY s.user_id, e.task_uuid, p.scope",
                (list(event_ids),),
            ).fetchall()
        matches: list[Match] = []
        for user_id, task_uuid, scope, sub_metadata, event_metadata in rows:
            entries = self._entries(str(scope), sub_metadata, event_metadata)
            if entries is None:
                continue
            matches.append(
                Match(
                    user_id=int(user_id),
                    task_uuid=str(task_uuid),
                    scope=str(scope),
                    entries=entries,
                )
            )
        return matches

    @staticmethod
    def _entries(
        scope: str,
        sub_metadata: Any,
        event_metadata: Any,
    ) -> list[dict[str, Any]] | None:
        """What one match tells the account, or None when it tells nothing.

        A subscription of the centre or county kind names its target, so the
        match carries that target; the all-reports kind names none, and the
        match carries the event's entries, the reports the run paired with
        its centre and county, for the composer's sake. The receipts these
        become are decided by ``_receipt_entries``. A subscription of a
        scoped kind whose metadata is empty matches nothing tellable and is
        left out.
        """
        if scope == "ALL":
            return list(event_metadata)
        if not sub_metadata:
            logger.warning(
                "subscription of scope %s with empty metadata matches nothing",
                scope,
            )
            return None
        return list(sub_metadata)

    @staticmethod
    def _receipt_entries(match: Match) -> list[dict[str, Any]] | None:
        """The flat receipt rows one match writes, or None for nothing.

        A centre or county match writes one row per target, the metadata a
        flat object naming it; the all-reports match writes exactly one row
        per account per run, its metadata the empty object, the shape that
        says the account follows every report. A subscription of a scoped
        kind whose metadata is empty tells nothing and is left out.
        """
        if match.scope == "ALL":
            return [{}]
        if not match.entries:
            return None
        return [dict(entry) for entry in match.entries]

    def consume(
        self, matches: Sequence[Match], event_ids: Sequence[int]
    ) -> int:
        """Writes the receipts and marks the claimed events processed.

        One transaction: every target an event matched becomes one receipt
        row, its metadata a flat object naming the target, and the
        all-reports kind one empty-object row per account; every claimed
        event leaves with ``processed_at``, matching nobody included. A row
        the account already holds for this run is left as it is, sent or
        skipped or still owed, so a requeued event cannot duplicate a
        receipt. The answer is how many rows were newly written.
        """
        written = 0
        with (
            self._connection.transaction(),
            self._connection.cursor() as cursor,
        ):
            for match in matches:
                entries = self._receipt_entries(match)
                if not entries:
                    continue
                held = {
                    frozenset(dict(row[0]).items())
                    for row in cursor.execute(
                        "SELECT metadata FROM clearcare.alert_notifications"
                        " WHERE user_id = %s AND task_uuid = %s",
                        (match.user_id, match.task_uuid),
                    ).fetchall()
                }
                for entry in entries:
                    key = frozenset(entry.items())
                    if key in held:
                        continue
                    cursor.execute(
                        "INSERT INTO clearcare.alert_notifications"
                        " (user_id, task_uuid, status, metadata)"
                        " VALUES (%s, %s, 'pending', %s)",
                        (
                            match.user_id,
                            match.task_uuid,
                            Jsonb(entry),
                        ),
                    )
                    held.add(key)
                    written += 1
            if event_ids:
                cursor.execute(
                    "UPDATE clearcare.alert_events"
                    " SET status = 'processed', processed_at = now()"
                    " WHERE id = ANY(%s)",
                    (list(event_ids),),
                )
        logger.info(
            "%d receipt rows written for %d processed events",
            written,
            len(event_ids),
        )
        return written

    def owed_receipts(self) -> list[Receipt]:
        """The receipts still owed an email, oldest first.

        Pending rows belong to this pass or to a stopped one; failed rows
        carry a send that has run out of attempts for now. Rows at the
        attempt cap are not here: their pass marks them skipped.
        """
        with self._connection.cursor() as cursor:
            rows = cursor.execute(
                "SELECT id, user_id, task_uuid, metadata, retry_count"
                " FROM clearcare.alert_notifications"
                " WHERE status IN ('pending', 'failed') AND retry_count < %s"
                " ORDER BY user_id, id",
                (ATTEMPT_CAP,),
            ).fetchall()
        return [
            Receipt(
                id=row[0],
                user_id=int(row[1]),
                task_uuid=str(row[2]),
                metadata=dict(row[3]),
                retry_count=int(row[4]),
            )
            for row in rows
        ]

    def still_subscribed(self, receipt_ids: Sequence[int]) -> list[int]:
        """The receipt rows an active subscription still covers.

        A failed send is retried by the next pass; if the account
        unsubscribed in between, the row is skipped and never emailed. The
        receipt's flat metadata names its kind: a ``centre_id`` alone a
        centre, a ``county_id`` alone a county, and the empty object the
        all-reports kind, whose subscription carries no target of its own.
        """
        if not receipt_ids:
            return []
        with self._connection.cursor() as cursor:
            rows = cursor.execute(
                "SELECT n.id"
                " FROM clearcare.alert_notifications n"
                " JOIN clearcare.alert_packages p"
                "   ON p.scope = CASE"
                "      WHEN n.metadata = '{}'::jsonb THEN 'ALL'"
                "      WHEN n.metadata ? 'centre_id' THEN 'CENTRE'"
                "      WHEN n.metadata ? 'county_id' THEN 'COUNTY'"
                "   END"
                " JOIN clearcare.alert_subscriptions s"
                "   ON s.user_id = n.user_id"
                "  AND s.alert_package_id = p.id"
                "  AND s.is_active"
                "  AND s.metadata = CASE"
                "      WHEN n.metadata = '{}'::jsonb THEN '[]'::jsonb"
                "      ELSE jsonb_build_array(n.metadata) END"
                " WHERE n.id = ANY(%s)",
                (list(receipt_ids),),
            ).fetchall()
        return [int(row[0]) for row in rows]

    def mark_sent(self, receipt_ids: Sequence[int]) -> None:
        """Records the receipts one email covered as sent."""
        with (
            self._connection.transaction(),
            self._connection.cursor() as cursor,
        ):
            cursor.execute(
                "UPDATE clearcare.alert_notifications"
                " SET status = 'sent', processed_at = now()"
                " WHERE id = ANY(%s)",
                (list(receipt_ids),),
            )

    def mark_skipped(self, receipt_ids: Sequence[int]) -> None:
        """Records receipts that will never email as skipped, terminal."""
        with (
            self._connection.transaction(),
            self._connection.cursor() as cursor,
        ):
            cursor.execute(
                "UPDATE clearcare.alert_notifications"
                " SET status = 'skipped', processed_at = now()"
                " WHERE id = ANY(%s)",
                (list(receipt_ids),),
            )

    def mark_failed(
        self, receipt_ids: Sequence[int], attempts: int, cap: int
    ) -> None:
        """Records the attempts on receipts a pass could not email.

        ``retry_count`` carries the count to the next pass, which claims
        these rows again; a row that reaches the cap becomes ``skipped``,
        the state that says the account will not be emailed about this run.
        """
        with (
            self._connection.transaction(),
            self._connection.cursor() as cursor,
        ):
            cursor.execute(
                "UPDATE clearcare.alert_notifications"
                " SET status = 'failed', retry_count = retry_count + %s"
                " WHERE id = ANY(%s)",
                (attempts, list(receipt_ids)),
            )
            exhausted = cursor.execute(
                "UPDATE clearcare.alert_notifications"
                " SET status = 'skipped', processed_at = now()"
                " WHERE id = ANY(%s) AND retry_count >= %s"
                " RETURNING id",
                (list(receipt_ids), cap),
            ).fetchall()
        if exhausted:
            logger.warning(
                "%d receipts gave up after %d attempts, marked skipped",
                len(exhausted),
                cap,
            )

    def cognito_sub(self, user_id: int) -> str | None:
        """The account's Cognito subject, the database's only identity."""
        with self._connection.cursor() as cursor:
            row = cursor.execute(
                "SELECT cognito_sub FROM clearcare.users WHERE id = %s",
                (user_id,),
            ).fetchone()
        return str(row[0]) if row is not None else None

    def unsubscribe_token(self, user_id: int) -> str:
        """The account's signed-out token, made on this account's first email.

        The row is created the first time an email is composed for the
        account (ADR-0034); the site's endpoint will look the account up by
        it and delete its subscriptions.
        """
        with (
            self._connection.transaction(),
            self._connection.cursor() as cursor,
        ):
            cursor.execute(
                "INSERT INTO clearcare.alert_unsubscribe (user_id) VALUES (%s)"
                " ON CONFLICT (user_id) DO NOTHING",
                (user_id,),
            )
            row = cursor.execute(
                "SELECT token FROM clearcare.alert_unsubscribe"
                " WHERE user_id = %s",
                (user_id,),
            ).fetchone()
        assert row is not None
        return str(row[0])

    def names(
        self, centre_ids: Sequence[str], county_ids: Sequence[int]
    ) -> tuple[dict[str, str | None], dict[int, str]]:
        """The display names behind the ids the digests carry.

        A centre's name is its newest register entry's, the same source the
        ingest spells counties from; a centre the register has not loaded
        stays without a name and the email spells the HIQA id instead.
        """
        centre_names: dict[str, str | None] = {}
        county_names: dict[int, str] = {}
        with self._connection.cursor() as cursor:
            if centre_ids:
                for centre_id, name in cursor.execute(
                    "SELECT DISTINCT ON (centre_id) centre_id, centre_name"
                    " FROM clearcare.register_entry WHERE centre_id = ANY(%s)"
                    " ORDER BY centre_id, extracted_at DESC",
                    (list(centre_ids),),
                ).fetchall():
                    centre_names[str(centre_id)] = str(name) if name else None
            if county_ids:
                for county_id, name in cursor.execute(
                    "SELECT id, name FROM clearcare.county WHERE id = ANY(%s)",
                    (list(county_ids),),
                ).fetchall():
                    county_names[int(county_id)] = str(name)
        return centre_names, county_names

    def unclaimed_events(self) -> int:
        """How many events wait beyond this pass's claim, for the exit code."""
        with self._connection.cursor() as cursor:
            row = cursor.execute(
                "SELECT count(*) FROM clearcare.alert_events"
                " WHERE processed_at IS NULL"
                " AND status IN ('pending', 'failed')"
            ).fetchone()
        assert row is not None
        return int(row[0])
