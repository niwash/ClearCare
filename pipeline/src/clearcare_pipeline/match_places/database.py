"""Reading which centres need an image, and storing the one that was matched.

A centre is due when the served register has it, its point is inside Google's
thirty days, and that point was geocoded on the day of the run. The last
condition is the geocode stage's 23-day cycle: it re-fetches every point 23
days old or more, so on that day the whole register is matched again, and on
the days between only a centre new to the register is. A centre with no point
is not due at all: there is nothing to measure a candidate against, so the
geocode stage runs first (ADR-0027, ADR-0030).
"""

import psycopg
from psycopg.rows import TupleRow

from clearcare_pipeline.match_places.places import Centre

Connection = psycopg.Connection[TupleRow]

# Google's coordinates may be kept for 30 calendar days at most, so a point
# older than that is no reference to measure a candidate against.
POINT_EXPIRES_AFTER_DAYS = 30

# Ages are counted in UTC calendar days, as the geocode stage counts them.
_AGE = (
    "(now() AT TIME ZONE 'UTC')::date"
    " - (location.geocoded_at AT TIME ZONE 'UTC')::date"
)


def due_centres(
    connection: Connection, everything: bool = False
) -> list[Centre]:
    """The served centres to ask Google about on this run.

    A centre is due when its point was geocoded today. That is not a retry
    but the refresh, riding the geocode stage's 23-day cycle rather than
    keeping a timer of its own; a home that fails the rule is therefore asked
    about once every 23 days, not once a night.

    With ``everything``, every centre whose point is still inside Google's
    thirty days is due: the first run, and a re-match after the rule changes.
    """
    where = f" WHERE {_AGE} < %s" if everything else f" WHERE {_AGE} = 0"
    # centre_search lists the same centres, but the pipeline is not granted
    # it, so this reads the tables it is built on.
    rows = connection.execute(
        "SELECT entry.centre_id, entry.centre_name, entry.address,"
        " entry.county, ST_Y(location.point::geometry),"
        " ST_X(location.point::geometry)"
        " FROM clearcare.register_entry AS entry"
        " INNER JOIN clearcare.register_publication USING (source_file_id)"
        " INNER JOIN clearcare.centre_location AS location USING (centre_id)"
        + where
        + " ORDER BY entry.centre_id",
        (POINT_EXPIRES_AFTER_DAYS,) if everything else (),
    ).fetchall()
    return [Centre(*row) for row in rows]


def store(connection: Connection, centre_id: str, place_id: str) -> None:
    """Writes the listing matched for the centre, replacing any it had."""
    connection.execute(
        "INSERT INTO clearcare.centre_image"
        " (centre_id, place_id, updated_at)"
        " VALUES (%s, %s, now())"
        " ON CONFLICT (centre_id) DO UPDATE SET place_id = excluded.place_id,"
        " updated_at = excluded.updated_at",
        (centre_id, place_id),
    )
