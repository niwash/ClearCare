"""Reading which centres need a point, and writing and deleting points.

The database's clock stamps geocoded_at. A point's age is the number of
calendar days in UTC from the day it was stamped to today, whatever the
session's time zone, so the rule is the same on RDS, in Compose and in the
tests (ADR-0027).
"""

import psycopg
from psycopg.rows import TupleRow

from clearcare_pipeline.geocode.google import Centre, Location

# Google's terms count calendar days: a point stamped on day D may be kept
# for 30 of them, so the run on day D+30 deletes it, at whatever time of day.
EXPIRES_AFTER_DAYS = 30
# RDS keeps seven days of backups. A point replaced by the run on day D+23
# ages out of them at about the time of the run on day D+30, which deletes
# any point still in the table. A point whose refreshes all failed stays in
# the backups for up to seven days after that.
REFRESH_AFTER_DAYS = 23

Connection = psycopg.Connection[TupleRow]


def delete_expired(connection: Connection) -> int:
    """Deletes every point 30 or more calendar days old; returns how many."""
    return connection.execute(
        "DELETE FROM clearcare.centre_location"
        " WHERE (now() AT TIME ZONE 'UTC')::date"
        " - (geocoded_at AT TIME ZONE 'UTC')::date >= %s",
        (EXPIRES_AFTER_DAYS,),
    ).rowcount


def due_centres(connection: Connection) -> list[Centre]:
    """The served snapshot's centres with no point or one 23 days old or more.

    Ages are in UTC calendar days, as for the deletion. Centres with no point
    come first, then the oldest points, so that a run cut short leaves the
    freshest for the next one.
    """
    # centre_search lists the same centres, but the pipeline is not granted
    # it, so this reads the two tables it is built on.
    rows = connection.execute(
        "SELECT entry.centre_id, entry.address, entry.county, entry.eircode"
        " FROM clearcare.register_entry AS entry"
        " INNER JOIN clearcare.register_publication USING (source_file_id)"
        " LEFT JOIN clearcare.centre_location AS location USING (centre_id)"
        " WHERE location.geocoded_at IS NULL"
        " OR (now() AT TIME ZONE 'UTC')::date"
        " - (location.geocoded_at AT TIME ZONE 'UTC')::date >= %s"
        " ORDER BY location.geocoded_at NULLS FIRST, entry.centre_id",
        (REFRESH_AFTER_DAYS,),
    ).fetchall()
    return [Centre(*row) for row in rows]


def store(connection: Connection, centre_id: str, location: Location) -> None:
    """Writes the centre's point and place_id, replacing any it had."""
    # ST_MakePoint takes longitude first.
    connection.execute(
        "INSERT INTO clearcare.centre_location"
        " (centre_id, point, place_id, geocoded_at)"
        " VALUES (%s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s,"
        " now())"
        " ON CONFLICT (centre_id) DO UPDATE SET point = excluded.point,"
        " place_id = excluded.place_id, geocoded_at = excluded.geocoded_at",
        (centre_id, location.longitude, location.latitude, location.place_id),
    )
