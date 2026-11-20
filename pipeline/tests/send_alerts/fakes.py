"""Test doubles for the dispatcher: the tables, the sender and Cognito."""

from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, timedelta
from typing import Any

from clearcare_pipeline.send_alerts.database import (
    ATTEMPT_CAP,
    CLAIM_LIMIT,
    ClaimedEvent,
    Match,
    Receipt,
)


class FakeEvents:
    """The alert tables in memory, as one pass works them."""

    def __init__(
        self,
        events: Sequence[dict[str, Any]] | None = None,
        subscriptions: Sequence[dict[str, Any]] | None = None,
        receipts: Sequence[dict[str, Any]] | None = None,
        users: Mapping[int, str | None] | None = None,
        centre_names: Mapping[str, str | None] | None = None,
        county_names: Mapping[int, str] | None = None,
    ) -> None:
        self.events: list[dict[str, Any]] = [
            {
                "id": index + 1,
                "package_id": event.get("package_id", 1),
                "scope": event.get("scope", "CENTRE"),
                "task_uuid": event.get(
                    "task_uuid", "00000000-0000-0000-0000-000000000001"
                ),
                "metadata": event.get("metadata", [{"centre_id": "117"}]),
                "status": event.get("status", "pending"),
                "created_at": event.get(
                    "created_at",
                    datetime(2026, 11, 19, 12, 0, tzinfo=UTC)
                    + timedelta(minutes=index),
                ),
                "processed_at": None,
            }
            for index, event in enumerate(events or [])
        ]
        self.subscriptions = list(subscriptions or [])
        self.receipts: list[dict[str, Any]] = [
            {
                "id": index + 1,
                "user_id": receipt["user_id"],
                "task_uuid": receipt["task_uuid"],
                "status": receipt.get("status", "pending"),
                "metadata": receipt.get("metadata", {}),
                "retry_count": receipt.get("retry_count", 0),
                "processed_at": None,
            }
            for index, receipt in enumerate(receipts or [])
        ]
        self.users = dict(users or {})
        self.centre_names = dict(centre_names or {})
        self.county_names = dict(county_names or {})
        self.tokens: dict[int, str] = {}
        self.package_ids = {"CENTRE": 1, "COUNTY": 2, "ALL": 3}

    def requeue_processing(self) -> int:
        requeued = 0
        for event in self.events:
            if event["status"] == "processing":
                event["status"] = "pending"
                requeued += 1
        return requeued

    def claim(self, limit: int = CLAIM_LIMIT) -> list[ClaimedEvent]:
        due = sorted(
            (
                event
                for event in self.events
                if event["status"] in ("pending", "failed")
            ),
            key=lambda event: (event["created_at"], event["id"]),
        )[:limit]
        for event in due:
            event["status"] = "processing"
        return [
            ClaimedEvent(
                id=event["id"],
                package_id=event["package_id"],
                scope=event["scope"],
                task_uuid=event["task_uuid"],
                metadata=list(event["metadata"]),
            )
            for event in due
        ]

    def match(self, event_ids: Sequence[int]) -> list[Match]:
        matches: list[Match] = []
        for event in self.events:
            if event["id"] not in event_ids:
                continue
            for subscription in self.subscriptions:
                if not self._covers(event, subscription):
                    continue
                entries = self._entries(event, subscription)
                if entries is None:
                    continue
                matches.append(
                    Match(
                        user_id=int(subscription["user_id"]),
                        task_uuid=event["task_uuid"],
                        scope=event["scope"],
                        entries=list(entries),
                    )
                )
        return matches

    @staticmethod
    def _covers(event: dict[str, Any], subscription: dict[str, Any]) -> bool:
        return (
            subscription["package_id"] == event["package_id"]
            and subscription["is_active"]
            and event["created_at"] >= subscription["created_at"]
            and all(
                entry in event["metadata"] for entry in subscription["metadata"]
            )
        )

    @staticmethod
    def _entries(
        event: dict[str, Any], subscription: dict[str, Any]
    ) -> list[dict[str, Any]] | None:
        if event["scope"] == "ALL":
            return list(event["metadata"])
        return list(subscription["metadata"]) or None

    def consume(
        self, matches: Sequence[Match], event_ids: Sequence[int]
    ) -> int:
        written = 0
        for match in matches:
            entries = self._receipt_entries(match)
            if not entries:
                continue
            existing = [
                receipt
                for receipt in self.receipts
                if receipt["user_id"] == match.user_id
                and receipt["task_uuid"] == match.task_uuid
            ]
            held = {
                frozenset(receipt["metadata"].items()) for receipt in existing
            }
            for entry in entries:
                key = frozenset(entry.items())
                if key in held:
                    continue
                self.receipts.append(
                    {
                        "id": len(self.receipts) + 1,
                        "user_id": match.user_id,
                        "task_uuid": match.task_uuid,
                        "status": "pending",
                        "metadata": dict(entry),
                        "retry_count": 0,
                        "processed_at": None,
                    }
                )
                held.add(key)
                written += 1
        for event in self.events:
            if event["id"] in event_ids:
                event["status"] = "processed"
                event["processed_at"] = datetime.now(UTC)
        return written

    @staticmethod
    def _receipt_entries(match: Match) -> list[dict[str, Any]] | None:
        if match.scope == "ALL":
            return [{}]
        return [dict(entry) for entry in match.entries] or None

    def owed_receipts(self) -> list[Receipt]:
        return [
            Receipt(
                id=receipt["id"],
                user_id=receipt["user_id"],
                task_uuid=receipt["task_uuid"],
                metadata=dict(receipt["metadata"]),
                retry_count=receipt["retry_count"],
            )
            for receipt in self.receipts
            if receipt["status"] in ("pending", "failed")
            and receipt["retry_count"] < ATTEMPT_CAP
        ]

    def still_subscribed(self, receipt_ids: Sequence[int]) -> list[int]:
        kept: list[int] = []
        for receipt_id in receipt_ids:
            receipt = next(
                (r for r in self.receipts if r["id"] == receipt_id), None
            )
            if receipt is None:
                continue
            meta = receipt["metadata"]
            if not meta:
                scope, target = "ALL", []
            elif "centre_id" in meta:
                scope, target = "CENTRE", [dict(meta)]
            else:
                scope, target = "COUNTY", [dict(meta)]
            covered = any(
                subscription["is_active"]
                and subscription["package_id"] == self.package_ids[scope]
                and subscription["metadata"] == target
                for subscription in self.subscriptions
            )
            if covered:
                kept.append(receipt_id)
        return kept

    def mark_sent(self, receipt_ids: Sequence[int]) -> None:
        for receipt in self.receipts:
            if receipt["id"] in receipt_ids:
                receipt["status"] = "sent"
                receipt["processed_at"] = datetime.now(UTC)

    def mark_skipped(self, receipt_ids: Sequence[int]) -> None:
        for receipt in self.receipts:
            if receipt["id"] in receipt_ids:
                receipt["status"] = "skipped"
                receipt["processed_at"] = datetime.now(UTC)

    def mark_failed(
        self, receipt_ids: Sequence[int], attempts: int, cap: int
    ) -> None:
        for receipt in self.receipts:
            if receipt["id"] not in receipt_ids:
                continue
            receipt["status"] = "failed"
            receipt["retry_count"] += attempts
            if receipt["retry_count"] >= cap:
                receipt["status"] = "skipped"
                receipt["processed_at"] = datetime.now(UTC)

    def cognito_sub(self, user_id: int) -> str | None:
        return self.users.get(user_id)

    def unsubscribe_token(self, user_id: int) -> str:
        return self.tokens.setdefault(user_id, f"token-{user_id}")

    def names(
        self, centre_ids: Sequence[str], county_ids: Sequence[int]
    ) -> tuple[dict[str, str | None], dict[int, str]]:
        return (
            {id: self.centre_names.get(id) for id in centre_ids},
            {
                id: self.county_names[id]
                for id in county_ids
                if id in self.county_names
            },
        )

    def unclaimed_events(self) -> int:
        return sum(
            1
            for event in self.events
            if event["status"] in ("pending", "failed")
        )


class FakeSender:
    """A sender that records its calls and may fail the first few times."""

    def __init__(self, failures: int = 0) -> None:
        self.calls: list[tuple[str, str, str, str]] = []
        self.ids: list[str] = []
        self.failures = failures

    def send(self, to: str, subject: str, text: str, html: str) -> str:
        self.calls.append((to, subject, text, html))
        if self.failures > 0:
            self.failures -= 1
            raise RuntimeError("sender is not answering")
        message_id = f"msg-{len(self.calls):03d}"
        self.ids.append(message_id)
        return message_id


class FakeAddresses:
    """Cognito in memory, or a resolver that raises for an outage."""

    def __init__(
        self,
        addresses: Mapping[str, str | None] | None = None,
        failures: int = 0,
    ) -> None:
        self.addresses = dict(addresses or {})
        self.failures = failures
        self.asked: list[str] = []

    def address(self, cognito_sub: str) -> str | None:
        self.asked.append(cognito_sub)
        if self.failures > 0:
            self.failures -= 1
            raise RuntimeError("cognito is not answering")
        return self.addresses.get(cognito_sub)
