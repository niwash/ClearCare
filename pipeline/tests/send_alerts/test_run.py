"""One dispatch pass, against the tables in memory."""

import logging
from datetime import UTC

import pytest
from botocore.exceptions import ClientError

from clearcare_pipeline.send_alerts.run import dispatch
from clearcare_pipeline.send_alerts.settings import Links
from tests.send_alerts.fakes import FakeAddresses, FakeEvents, FakeSender

LINKS = Links("https://clearcare.test")
USER = 1
SUB = "sub-one"
EVENT = {
    "package_id": 1,
    "scope": "CENTRE",
    "task_uuid": "00000000-0000-0000-0000-000000000001",
    "metadata": [{"centre_id": "117"}],
}


class RejectingSender:
    """A sender that refuses with SES's error, the address in its message."""

    def send(self, to: str, subject: str, text: str, html: str) -> str:
        raise ClientError(
            {
                "Error": {
                    "Code": "MessageRejected",
                    "Message": f"{to} is not verified",
                }
            },
            "SendEmail",
        )


def _tables(
    created_before_subscription: bool = False,
    status: str = "pending",
) -> FakeEvents:
    """One centre event, one active centre subscription, one account.

    The subscription's ``created_at`` sits after the event's by an hour
    unless the event is asked to predate it: alerts start when you
    subscribe, so an event written before the subscription matches nobody.
    """
    tables = FakeEvents(
        events=[{**EVENT, "status": status}],
        subscriptions=[
            {
                "user_id": USER,
                "package_id": 1,
                "metadata": [{"centre_id": "117"}],
                "is_active": True,
                "created_at": _tables_created(
                    13 if created_before_subscription else 11
                ),
            }
        ],
        users={USER: SUB},
    )
    # The event's created_at is an hour before the subscription's default,
    # or two hours before when it must predate it.
    tables.events[0]["created_at"] = _tables_created(
        10 if created_before_subscription else 12
    )
    return tables


def _tables_created(hour: int):
    from datetime import datetime

    return datetime(2026, 11, 19, hour, 0, tzinfo=UTC)


def test_a_closed_gate_consumes_the_events_and_owes_nothing() -> None:
    tables = _tables()

    summary = dispatch(tables, None, None, None)

    assert summary.claimed == 1
    assert summary.events_processed == 1
    assert summary.receipts_owed == 0
    assert tables.events[0]["status"] == "processed"
    assert tables.receipts == []


def test_an_open_gate_sends_one_digest_and_records_it() -> None:
    tables = _tables()
    sender = FakeSender()
    addresses = FakeAddresses({SUB: "someone@clearcare.test"})

    summary = dispatch(tables, sender, addresses, LINKS)

    assert summary.emails_sent == 1
    assert summary.receipts_owed == 1
    (to, _subject, text, _html) = sender.calls[0]
    assert to == "someone@clearcare.test"
    assert "Reports from centres you follow" in text
    assert (
        "Unsubscribe from all alerts: "
        "https://clearcare.test/alerts/unsubscribe?token=token-1" in text
    )
    receipt = tables.receipts[0]
    assert receipt["status"] == "sent"
    assert receipt["metadata"] == {"centre_id": "117"}
    assert tables.events[0]["status"] == "processed"
    assert tables.tokens == {USER: "token-1"}


def test_an_all_reports_match_writes_one_empty_row_and_a_generic_section() -> (
    None
):
    tables = FakeEvents(
        events=[
            {
                "package_id": 3,
                "scope": "ALL",
                "task_uuid": "00000000-0000-0000-0000-000000000003",
                "metadata": [
                    {"centre_id": "108", "county_id": 6},
                    {"centre_id": "309", "county_id": 7},
                ],
            }
        ],
        subscriptions=[
            {
                "user_id": USER,
                "package_id": 3,
                "metadata": [],
                "is_active": True,
                "created_at": _tables_created(11),
            }
        ],
        users={USER: SUB},
    )
    tables.events[0]["created_at"] = _tables_created(12)
    sender = FakeSender()

    summary = dispatch(tables, sender, FakeAddresses({SUB: "a@b.c"}), LINKS)

    # One empty row per run says the account follows every report; the
    # email's everywhere section is the generic line and names no centre.
    assert summary.receipts_owed == 1
    receipt = tables.receipts[0]
    assert receipt["metadata"] == {}
    assert receipt["status"] == "sent"
    (_to, _subject, text, _html) = sender.calls[0]
    assert "New reports across Ireland" in text
    assert "New inspection reports have been published across the site." in text
    assert "Fern Valley" not in text


def test_an_event_older_than_the_subscription_matches_nobody() -> None:
    tables = _tables(created_before_subscription=True)
    sender = FakeSender()

    summary = dispatch(tables, sender, FakeAddresses({SUB: "a@b.c"}), LINKS)

    assert summary.receipts_owed == 0
    assert summary.emails_sent == 0
    assert sender.calls == []
    assert tables.events[0]["status"] == "processed"


def test_a_stopped_run_s_email_is_not_sent_twice() -> None:
    tables = _tables(status="processing")
    tables.receipts.append(
        {
            "id": 1,
            "user_id": USER,
            "task_uuid": EVENT["task_uuid"],
            "status": "sent",
            "metadata": {"centre_id": "117"},
            "retry_count": 0,
            "processed_at": None,
        }
    )
    sender = FakeSender()

    summary = dispatch(tables, sender, FakeAddresses({SUB: "a@b.c"}), LINKS)

    # The stopped run's claim is requeued and finished, but the sent
    # receipt keeps its email from going out again.
    assert summary.requeued == 1
    assert summary.emails_sent == 0
    assert sender.calls == []
    assert tables.events[0]["status"] == "processed"


def test_a_send_that_keeps_failing_is_retried_three_times_then_failed() -> None:
    tables = _tables()
    sleeps: list[float] = []
    sender = FakeSender(failures=99)

    summary = dispatch(
        tables,
        sender,
        FakeAddresses({SUB: "a@b.c"}),
        LINKS,
        sleep=sleeps.append,
    )

    assert summary.emails_failed == 1
    assert len(sender.calls) == 3
    # The pauses sit between the attempts, not after the last.
    assert sleeps == [30.0, 120.0]
    receipt = tables.receipts[0]
    assert receipt["status"] == "failed"
    assert receipt["retry_count"] == 3


def test_a_failed_send_logs_the_ses_code_and_not_the_address(
    caplog: pytest.LogCaptureFixture,
) -> None:
    tables = _tables()

    with caplog.at_level(logging.WARNING):
        summary = dispatch(
            tables,
            RejectingSender(),
            FakeAddresses({SUB: "a@b.c"}),
            LINKS,
            sleep=lambda _s: None,
        )

    assert summary.emails_failed == 1
    assert "MessageRejected" in caplog.text
    assert "a@b.c" not in caplog.text


def test_a_failed_send_is_retried_by_the_next_pass_and_ends_skipped() -> None:
    tables = _tables()
    sender = FakeSender(failures=99)
    addresses = FakeAddresses({SUB: "a@b.c"})

    dispatch(tables, sender, addresses, LINKS, sleep=lambda _s: None)
    dispatch(tables, sender, addresses, LINKS, sleep=lambda _s: None)
    summary = dispatch(tables, sender, addresses, LINKS, sleep=lambda _s: None)

    # Three passes, three attempts each: the account has had nine tries.
    receipt = tables.receipts[0]
    assert receipt["status"] == "skipped"
    assert receipt["retry_count"] == 9
    # The pass's own counter still says the send failed; the row's status
    # is where the give-up is recorded.
    assert summary.emails_failed == 1


def test_a_send_that_recovers_on_the_second_attempt_sends() -> None:
    tables = _tables()
    sleeps: list[float] = []
    sender = FakeSender(failures=1)

    summary = dispatch(
        tables,
        sender,
        FakeAddresses({SUB: "a@b.c"}),
        LINKS,
        sleep=sleeps.append,
    )

    assert summary.emails_sent == 1
    assert len(sender.calls) == 2
    assert sleeps == [30.0]
    assert tables.receipts[0]["status"] == "sent"


def test_an_account_without_an_address_is_skipped_never_retried() -> None:
    tables = _tables()
    sender = FakeSender()

    summary = dispatch(tables, sender, FakeAddresses({SUB: None}), LINKS)

    assert summary.receipts_skipped == 1
    assert sender.calls == []
    assert tables.receipts[0]["status"] == "skipped"


def test_a_backoff_budget_keeps_one_outage_from_stretching_the_pass() -> None:
    tables = FakeEvents(
        events=[
            {
                **EVENT,
                "task_uuid": f"00000000-0000-0000-0000-00000000000{index}",
                "metadata": [{"centre_id": "117"}],
            }
            for index in range(1, 6)
        ],
        subscriptions=[
            {
                "user_id": USER + index,
                "package_id": 1,
                "metadata": [{"centre_id": "117"}],
                "is_active": True,
                "created_at": _tables_created(9),
            }
            for index in range(1, 6)
        ],
        users={USER + index: SUB for index in range(1, 6)},
    )
    for index, event in enumerate(tables.events):
        event["created_at"] = _tables_created(10 + index)
    sleeps: list[float] = []
    sender = FakeSender(failures=99)

    dispatch(
        tables,
        sender,
        FakeAddresses({SUB: "a@b.c"}),
        LINKS,
        sleep=sleeps.append,
    )

    # Five accounts fail; the shared budget of ten minutes covers only so
    # many pauses, and the rest of the attempts run back to back.
    assert sum(sleeps) <= 600.0
    assert len(sender.calls) == 15


def test_more_events_than_one_pass_claims_are_left_for_the_next() -> None:
    tables = FakeEvents(
        events=[{**EVENT} for _ in range(600)],
    )
    for index, event in enumerate(tables.events):
        event["created_at"] = _tables_created(index % 24)

    summary = dispatch(tables, None, None, None)

    assert summary.claimed == 500
    assert summary.events_left == 100


def test_a_cancelled_subscription_is_never_emailed_on_retry() -> None:
    tables = _tables()
    sender = FakeSender(failures=99)
    addresses = FakeAddresses({SUB: "a@b.c"})

    # The first pass fails and leaves the receipt owed.
    dispatch(tables, sender, addresses, LINKS, sleep=lambda _s: None)
    assert tables.receipts[0]["status"] == "failed"

    # The account unsubscribes before the next pass: the row is gone.
    tables.subscriptions.clear()

    summary = dispatch(tables, sender, addresses, LINKS, sleep=lambda _s: None)

    assert summary.receipts_skipped == 1
    assert summary.emails_sent == 0
    assert len(sender.calls) == 3  # the retried pass attempts nothing
    assert tables.receipts[0]["status"] == "skipped"
