"""The pass against the real schema, as the pipeline role (needs Docker)."""

import hashlib
import logging
import uuid

import pytest

from clearcare_pipeline.send_alerts.cognito import Addresses
from clearcare_pipeline.send_alerts.database import Dispatcher
from clearcare_pipeline.send_alerts.email import LogSender
from clearcare_pipeline.send_alerts.run import Summary, dispatch
from clearcare_pipeline.send_alerts.settings import Links
from tests.database import (
    MIGRATOR,
    PIPELINE,
    Connection,
    Database,
    migrated_database,
)
from tests.send_alerts.fakes import FakeAddresses, FakeSender

STORE = (
    "INSERT INTO clearcare.source_file"
    " (source, url, sha256, fetched_at)"
    " VALUES ('inspection-reports', %s, %s, now())"
    " RETURNING source_file_id"
)
REGISTER_ENTRY = (
    "INSERT INTO clearcare.register_entry"
    " (source_file_id, centre_id, source_record, centre_name, address,"
    " county, hiqa_url, extracted_at, extractor_version)"
    " VALUES (%s, %s, 1, 'Fern Valley Nursing Home', 'Sample Street',"
    " 'Carlow', 'https://example.test/register', now(), 'test-version')"
)
RECEIPTS = (
    "SELECT user_id, task_uuid, status, metadata, retry_count, processed_at"
    " FROM clearcare.alert_notifications ORDER BY id"
)
EVENTS = "SELECT status, processed_at FROM clearcare.alert_events ORDER BY id"

LINKS = Links("https://clearcare.test")
ADDRESS = {"sub-one": "someone@clearcare.test"}


def _user(database: Database, sub: str) -> int:
    with database.connect(MIGRATOR) as connection:
        connection.execute("SET ROLE clearcare_owner")
        row = connection.execute(
            "INSERT INTO clearcare.users (cognito_sub) VALUES (%s)"
            " RETURNING id",
            (sub,),
        ).fetchone()
    assert row is not None
    return int(row[0])


def _subscription(
    database: Database,
    user_id: int,
    scope: str,
    metadata: str,
    created_at: str = "2026-11-19 09:00:00+00",
) -> None:
    with database.connect(MIGRATOR) as connection:
        connection.execute("SET ROLE clearcare_owner")
        connection.execute(
            "INSERT INTO clearcare.alert_subscriptions"
            " (user_id, alert_package_id, metadata, created_at)"
            " SELECT %s, id, %s::jsonb, %s::timestamptz"
            " FROM clearcare.alert_packages WHERE scope = %s",
            (user_id, metadata, created_at, scope),
        )


def _event(
    connection: Connection,
    scope: str,
    metadata: str,
    created_at: str = "2026-11-19 12:00:00+00",
) -> int:
    package = connection.execute(
        "SELECT id FROM clearcare.alert_packages WHERE scope = %s", (scope,)
    ).fetchone()
    assert package is not None
    row = connection.execute(
        "INSERT INTO clearcare.alert_events"
        " (alert_package_id, task_uuid, status, metadata, created_at)"
        " VALUES (%s, %s, 'pending', %s, %s) RETURNING id",
        (package[0], str(uuid.uuid4()), metadata, created_at),
    ).fetchone()
    assert row is not None
    return int(row[0])


def _centre(connection: Connection, centre_id: str = "117") -> None:
    connection.execute(
        "INSERT INTO clearcare.centre (centre_id) VALUES (%s)",
        (centre_id,),
    )
    stored = connection.execute(
        STORE,
        (
            f"https://example.test/{centre_id}.pdf",
            hashlib.sha256(centre_id.encode()).hexdigest(),
        ),
    ).fetchone()
    assert stored is not None
    connection.execute(REGISTER_ENTRY, (stored[0], centre_id))


def test_a_pass_sends_the_digest_and_leaves_everything_recorded(
    caplog: pytest.LogCaptureFixture,
) -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        user_id = _user(database, "sub-one")
        _subscription(database, user_id, "CENTRE", '[{"centre_id": "117"}]')
        _centre(connection)
        _event(connection, "CENTRE", '[{"centre_id": "117"}]')
        addresses: Addresses = FakeAddresses(ADDRESS)
        with caplog.at_level(logging.INFO):
            summary = dispatch(
                Dispatcher(connection), LogSender(), addresses, LINKS
            )

        assert summary.emails_sent == 1
        rows = connection.execute(RECEIPTS).fetchall()
        assert len(rows) == 1
        assert rows[0][0] == user_id
        assert rows[0][2] == "sent"
        assert rows[0][3] == {"centre_id": "117"}
        assert rows[0][5] is not None
        events = connection.execute(EVENTS).fetchall()
        assert events == [("processed", events[0][1])]
        assert events[0][1] is not None
        # The signed-out token came into being with the first email, and
        # the log carries the body but never the address.
        assert connection.execute(
            "SELECT count(*) FROM clearcare.alert_unsubscribe"
        ).fetchone() == (1,)
        assert "Fern Valley Nursing Home" in caplog.text
        assert "centres/117/inspections" in caplog.text
        assert "someone@clearcare.test" not in caplog.text


def test_an_event_older_than_the_subscription_is_consumed_silently() -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        user_id = _user(database, "sub-one")
        _subscription(database, user_id, "CENTRE", '[{"centre_id": "117"}]')
        _centre(connection)
        # The event is written before the subscription: alerts start when
        # you subscribe, so this one matches nobody.
        _event(
            connection,
            "CENTRE",
            '[{"centre_id": "117"}]',
            created_at="2026-11-19 08:00:00+00",
        )

        summary = dispatch(
            Dispatcher(connection), LogSender(), FakeAddresses({}), LINKS
        )

        assert summary.receipts_owed == 0
        assert summary.emails_sent == 0
        assert connection.execute(RECEIPTS).fetchall() == []
        events = connection.execute(EVENTS).fetchall()
        assert events and events[0][0] == "processed"


def test_a_closed_gate_consumes_everything_and_writes_nothing() -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        user_id = _user(database, "sub-one")
        _subscription(database, user_id, "CENTRE", '[{"centre_id": "117"}]')
        _centre(connection)
        _event(connection, "CENTRE", '[{"centre_id": "117"}]')

        summary = dispatch(Dispatcher(connection), None, None, None)

        assert summary.events_processed == 1
        assert summary.receipts_owed == 0
        assert connection.execute(RECEIPTS).fetchall() == []
        assert connection.execute(
            "SELECT status FROM clearcare.alert_events"
        ).fetchall() == [("processed",)]


def test_a_county_and_an_all_reports_event_reach_their_account() -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        user_id = _user(database, "sub-one")
        carlow = connection.execute(
            "SELECT id FROM clearcare.county WHERE name = 'Carlow'"
        ).fetchone()
        assert carlow is not None
        _subscription(
            database, user_id, "COUNTY", f'[{{"county_id": {carlow[0]}}}]'
        )
        _subscription(database, user_id, "ALL", "[]")
        _centre(connection)
        _event(connection, "COUNTY", f'[{{"county_id": {carlow[0]}}}]')
        _event(connection, "ALL", '[{"centre_id": "117", "county_id": 2}]')

        summary = dispatch(
            Dispatcher(connection),
            LogSender(),
            FakeAddresses(ADDRESS),
            LINKS,
        )

        # One digest covers both events; a receipt row records each target,
        # and the all-reports kind one empty-object row.
        assert summary.emails_sent == 1
        rows = connection.execute(RECEIPTS).fetchall()
        assert len(rows) == 2
        assert all(row[2] == "sent" for row in rows)
        county_row = next(row for row in rows if "county_id" in row[3])
        all_row = next(row for row in rows if row[3] == {})
        assert county_row[3] == {"county_id": carlow[0]}
        assert all_row[3] == {}


def test_a_stopped_run_s_processing_events_are_requeued_and_finished() -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        user_id = _user(database, "sub-one")
        _subscription(database, user_id, "CENTRE", '[{"centre_id": "117"}]')
        _centre(connection)
        event_id = _event(connection, "CENTRE", '[{"centre_id": "117"}]')
        connection.execute(
            "UPDATE clearcare.alert_events SET status = 'processing'"
            " WHERE id = %s",
            (event_id,),
        )

        summary = dispatch(
            Dispatcher(connection), LogSender(), FakeAddresses({}), LINKS
        )

        assert summary.requeued == 1
        assert summary.emails_sent == 0
        events = connection.execute(EVENTS).fetchall()
        assert events[0][0] == "processed"
        assert events[0][1] is not None


def test_a_send_that_keeps_failing_ends_skipped_after_nine_attempts() -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        user_id = _user(database, "sub-one")
        _subscription(database, user_id, "CENTRE", '[{"centre_id": "117"}]')
        _centre(connection)
        _event(connection, "CENTRE", '[{"centre_id": "117"}]')
        sender = FakeSender(failures=99)
        addresses: Addresses = FakeAddresses(ADDRESS)

        summary: Summary | None = None
        for _pass in range(3):
            summary = dispatch(
                Dispatcher(connection),
                sender,
                addresses,
                LINKS,
                sleep=lambda _s: None,
            )

        assert summary is not None
        assert summary.emails_failed == 1
        rows = connection.execute(RECEIPTS).fetchall()
        assert rows[0][2] == "skipped"
        assert rows[0][4] == 9


def test_the_pass_never_emails_an_account_twice_for_one_run() -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        user_id = _user(database, "sub-one")
        _subscription(database, user_id, "CENTRE", '[{"centre_id": "117"}]')
        _centre(connection)
        event_id = _event(connection, "CENTRE", '[{"centre_id": "117"}]')

        summary = dispatch(
            Dispatcher(connection),
            LogSender(),
            FakeAddresses(ADDRESS),
            LINKS,
        )
        assert summary.emails_sent == 1
        # A stopped run's unfinished work: the event is back to claimed,
        # its receipt already sent.
        connection.execute(
            "UPDATE clearcare.alert_events SET status = 'processing',"
            " processed_at = NULL WHERE id = %s",
            (event_id,),
        )
        sender = FakeSender()

        dispatch(Dispatcher(connection), sender, FakeAddresses({}), LINKS)

        assert sender.calls == []


def test_an_all_reports_only_account_gets_the_generic_everywhere_section(
    caplog: pytest.LogCaptureFixture,
) -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        user_id = _user(database, "sub-one")
        _subscription(database, user_id, "ALL", "[]")
        _centre(connection)
        _event(
            connection,
            "ALL",
            '[{"centre_id": "117", "county_id": 2},'
            ' {"centre_id": "238", "county_id": 7}]',
        )
        addresses: Addresses = FakeAddresses(ADDRESS)
        with caplog.at_level(logging.INFO):
            summary = dispatch(
                Dispatcher(connection), LogSender(), addresses, LINKS
            )

        assert summary.emails_sent == 1
        rows = connection.execute(RECEIPTS).fetchall()
        assert len(rows) == 1
        assert rows[0][3] == {}
        assert rows[0][2] == "sent"
        # The everywhere section is the generic line: the empty row names
        # no target, so the email cannot name centres.
        assert (
            "New inspection reports have been published across the site."
            in caplog.text
        )
        assert "Fern Valley Nursing Home" not in caplog.text
