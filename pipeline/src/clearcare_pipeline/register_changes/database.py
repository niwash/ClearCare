"""Appending register changes to PostgreSQL."""

from collections.abc import Iterable
from dataclasses import asdict

import psycopg
from psycopg.rows import TupleRow

from clearcare_pipeline.register_changes.differ import (
    RULES_VERSION,
    RegisterChange,
)

Connection = psycopg.Connection[TupleRow]


def append_changes(
    connection: Connection, changes: Iterable[RegisterChange]
) -> int:
    """Adds each change that is not stored yet, in one transaction.

    A change already stored at RULES_VERSION is left out, so running again
    adds nothing. A change for a centre the database does not have yet is
    left out as well; a later run adds it once the register has the centre.

    Args:
        connection: Logs in as clearcare_pipeline and has no transaction open.
        changes: The changes of the stored snapshots.

    Returns:
        How many rows were added.
    """
    with connection.transaction(), connection.cursor() as cursor:
        cursor.executemany(
            "INSERT INTO clearcare.register_change (centre_id, kind,"
            " change_date, shown_on, snapshot_sha256, condition_number,"
            " before_text, after_text, beds_before, beds_after,"
            " registered_until, registration_number, rules_version)"
            # A SELECT list does not take its types from the columns.
            " SELECT %(centre_id)s::text, %(kind)s::text,"
            " %(change_date)s::date, %(shown_on)s::date,"
            " %(snapshot_sha256)s::text,"
            " %(condition_number)s::integer, %(before_text)s::text,"
            " %(after_text)s::text, %(beds_before)s::integer,"
            " %(beds_after)s::integer, %(registered_until)s::date,"
            " %(registration_number)s::text, %(rules_version)s::text"
            " WHERE EXISTS (SELECT FROM clearcare.centre"
            "  WHERE centre_id = %(centre_id)s)"
            " ON CONFLICT DO NOTHING",
            [
                {**asdict(change), "rules_version": RULES_VERSION}
                for change in changes
            ],
        )
        return cursor.rowcount
