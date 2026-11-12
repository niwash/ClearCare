"""Which centres are due, and storing the listing that was matched for one."""

from typing import cast

from clearcare_pipeline.match_places.database import (
    POINT_EXPIRES_AFTER_DAYS,
    Connection,
    due_centres,
    store,
)
from tests.match_places.fakes import FakeConnection


def as_connection(fake: FakeConnection) -> Connection:
    """The stage's connection, as the fake that answers instead of psycopg."""
    return cast(Connection, fake)


def test_storing_records_the_listing() -> None:
    fake = FakeConnection()
    store(as_connection(fake), "1", "ChIJ1")
    assert fake.writes == [("1", "ChIJ1")]


def test_a_centre_is_due_only_on_the_day_its_point_was_taken() -> None:
    """The refresh rides geocode's 23-day cycle; it is not a nightly retry."""
    fake = FakeConnection()
    due_centres(as_connection(fake))
    query = fake.queries[0]
    assert "= 0" in query
    assert "%s" not in query


def test_everything_still_respects_the_thirty_days() -> None:
    """--all re-matches the register, but never against an expired point."""
    fake = FakeConnection()
    due_centres(as_connection(fake), everything=True)
    query = fake.queries[0]
    assert "< %s" in query
    assert POINT_EXPIRES_AFTER_DAYS == 30


def test_a_centre_with_no_point_is_never_due() -> None:
    """There is nothing to measure a candidate against."""
    fake = FakeConnection()
    due_centres(as_connection(fake))
    assert "INNER JOIN clearcare.centre_location" in fake.queries[0]
