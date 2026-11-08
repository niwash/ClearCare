# Runs the geocode stage against a real PostgreSQL (tests/database.py), as the
# pipeline's role, with a fake in place of Google's Geocoding API.

import logging
import math
from collections.abc import Iterator

import pytest

from clearcare_pipeline.exit_codes import EXIT_DONE, EXIT_FAILED, EXIT_RETRY
from clearcare_pipeline.geocode.__main__ import main
from clearcare_pipeline.geocode.google import Centre
from clearcare_pipeline.snapshots.fetch import FetchError
from tests.database import (
    PASSWORDS,
    PIPELINE,
    SUPERUSER,
    Database,
    migrated_database,
)
from tests.geocode.fakes import Answer, FakeGoogle, found, http, status

pytestmark = pytest.mark.database

KEY = "AIzaTestOnlyKey0123456789"
GALWAY = Centre("101", "1 Sample Road, Galway, A65 F4E2", "Galway", "A65F4E2")
LIMERICK = Centre(
    "102", "2 Sample Road, Limerick, V94 X2Y4", "Limerick", "V94X2Y4"
)
CORK = Centre("103", "3 Sample Road, Cork, T12 AC34", "Cork", "T12AC34")
NO_EIRCODE = Centre("104", "Church Road, Ballincollig, Co. Cork", "Cork", None)
UNSERVED = Centre("105", "5 Sample Road, Sligo, F91 X2Y4", "Sligo", "F91X2Y4")
# Where _store_point puts a centre, so a test can tell a new point from it.
OLD_POINT = (52.0, -8.0, "old-place", False)
# Times of day in UTC for _store_point, at either end of a calendar day.
EARLY = "00:01"
LATE = "23:59"


@pytest.fixture(scope="module")
def server() -> Iterator[Database]:
    with migrated_database() as database:
        yield database


@pytest.fixture
def database(server: Database, monkeypatch: pytest.MonkeyPatch) -> Database:
    # Each test starts with no centres and no points. The stage finds the
    # database through libpq's variables, as it does in a task.
    with server.connect(SUPERUSER) as connection:
        connection.execute(
            "TRUNCATE clearcare.centre_location,"
            " clearcare.register_publication, clearcare.register_entry,"
            " clearcare.centre, clearcare.source_file CASCADE"
        )
    monkeypatch.setenv("PGHOST", server.host)
    monkeypatch.setenv("PGPORT", str(server.port))
    monkeypatch.setenv("PGDATABASE", "clearcare")
    monkeypatch.setenv("PGUSER", PIPELINE)
    monkeypatch.setenv("PGPASSWORD", PASSWORDS[PIPELINE])
    monkeypatch.setenv("GOOGLE_GEOCODING_API_KEY", KEY)
    return server


def _publish(database: Database, *centres: Centre) -> None:
    """Serves a register snapshot that lists these centres."""
    source_file_id = _load(database, *centres)
    with database.connect(SUPERUSER) as connection:
        connection.execute(
            "INSERT INTO clearcare.register_publication"
            " (source_file_id, published_at) VALUES (%s, now())",
            (source_file_id,),
        )


def _load(database: Database, *centres: Centre) -> int:
    """Stores a register snapshot of these centres, without serving it."""
    with database.connect(SUPERUSER) as connection:
        source = connection.execute(
            "INSERT INTO clearcare.source_file"
            " (source, url, sha256, fetched_at)"
            " VALUES ('register', %s, %s, now()) RETURNING source_file_id",
            (f"https://example.test/{centres[0].centre_id}.csv", "ab" * 32),
        ).fetchone()
        assert source is not None
        for record, centre in enumerate(centres, start=1):
            connection.execute(
                "INSERT INTO clearcare.centre (centre_id) VALUES (%s)",
                (centre.centre_id,),
            )
            connection.execute(
                "INSERT INTO clearcare.register_entry (source_file_id,"
                " source_record, centre_id, centre_name, address, county,"
                " eircode, hiqa_url, extracted_at, extractor_version)"
                " VALUES (%s, %s, %s, 'Sample Nursing Home', %s, %s, %s,"
                " 'https://example.test/centre', now(), 'test')",
                (
                    source[0],
                    record,
                    centre.centre_id,
                    centre.address,
                    centre.county,
                    centre.eircode,
                ),
            )
    return source[0]


def _store_point(
    database: Database, centre: Centre, *, days_ago: int, at: str
) -> None:
    """Gives the centre the old point, geocoded at a UTC time days_ago."""
    with database.connect(SUPERUSER) as connection:
        connection.execute(
            "INSERT INTO clearcare.centre_location"
            " (centre_id, point, place_id, geocoded_at)"
            " VALUES (%s, ST_SetSRID(ST_MakePoint(-8.0, 52.0), 4326),"
            " 'old-place',"
            " ((now() AT TIME ZONE 'UTC')::date - %s::integer + %s::time)"
            " AT TIME ZONE 'UTC')",
            (centre.centre_id, days_ago, at),
        )


def _points(database: Database) -> dict[str, tuple[float, float, str, bool]]:
    """Each centre's latitude, longitude, place_id, and whether it is new."""
    with database.connect(SUPERUSER) as connection:
        rows = connection.execute(
            "SELECT centre_id, ST_Y(point::geometry), ST_X(point::geometry),"
            " place_id, geocoded_at > now() - interval '1 minute'"
            " FROM clearcare.centre_location"
        ).fetchall()
    return {row[0]: (row[1], row[2], row[3], row[4]) for row in rows}


def _geocode(google: FakeGoogle, sleeps: list[float] | None = None) -> int:
    return main(
        [],
        fetcher=google,
        sleep=(sleeps if sleeps is not None else []).append,
    )


def _logged(caplog: pytest.LogCaptureFixture, *words: str) -> bool:
    """Whether one log line holds all the words."""
    return any(
        all(word in record.getMessage() for word in words)
        for record in caplog.records
    )


def test_points_30_calendar_days_old_are_deleted_even_with_geocoding_off(
    database: Database,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO)
    _publish(database, GALWAY, LIMERICK)
    # Whatever the time of day: GALWAY's point may be under 30 times 24
    # hours old, and LIMERICK's over 29 times 24.
    _store_point(database, GALWAY, days_ago=30, at=LATE)
    _store_point(database, LIMERICK, days_ago=29, at=EARLY)
    # What Compose passes when .env sets no key.
    monkeypatch.setenv("GOOGLE_GEOCODING_API_KEY", "")
    google = FakeGoogle({})

    assert _geocode(google) == EXIT_DONE

    assert _points(database) == {LIMERICK.centre_id: OLD_POINT}
    assert google.queries == []
    assert _logged(caplog, "geocoding is off")


def test_centres_with_no_point_or_one_23_calendar_days_old_are_geocoded(
    database: Database,
) -> None:
    _load(database, UNSERVED)
    _publish(database, GALWAY, LIMERICK, CORK)
    # Whatever the time of day: LIMERICK's point may be under 23 times 24
    # hours old, and CORK's over 22 times 24.
    _store_point(database, LIMERICK, days_ago=23, at=LATE)
    _store_point(database, CORK, days_ago=22, at=EARLY)
    google = FakeGoogle(
        {
            # Google's spacing and case differ from the register's.
            "A65 F4E2": [found(postal_code="a65f4e2", place_id="galway")],
            "V94 X2Y4": [
                found(
                    latitude=52.6638,
                    longitude=-8.6267,
                    postal_code="V94 X2Y4",
                    county="County Limerick",
                    place_id="limerick",
                )
            ],
        }
    )

    assert _geocode(google) == EXIT_DONE

    # Not UNSERVED's "F91 X2Y4": only an unserved snapshot lists it.
    assert sorted(google.addresses) == ["A65 F4E2", "V94 X2Y4"]
    for query in google.queries:
        assert query["components"] == "country:IE"
        assert query["key"] == KEY
    assert _points(database) == {
        GALWAY.centre_id: (53.2707, -9.0568, "galway", True),
        LIMERICK.centre_id: (52.6638, -8.6267, "limerick", True),
        CORK.centre_id: OLD_POINT,
    }


@pytest.mark.parametrize(
    ("answer", "reason"),
    [
        (status("ZERO_RESULTS"), "zero_results"),
        (found(partial_match=True), "partial"),
        (found(location=False), "location"),
        (found(latitude=math.nan), "location"),
        (found(longitude=math.inf), "location"),
        (found(postal_code="A65 F4E3"), "eircode"),
    ],
)
def test_an_answer_that_breaks_a_rule_leaves_the_centre_unresolved(
    database: Database,
    caplog: pytest.LogCaptureFixture,
    answer: Answer,
    reason: str,
) -> None:
    caplog.set_level(logging.DEBUG)
    _publish(database, GALWAY)

    assert _geocode(FakeGoogle({"A65 F4E2": [answer]})) == EXIT_DONE

    assert _points(database) == {}
    assert _logged(caplog, GALWAY.centre_id, reason)
    # Neither the address Google gave nor its message is logged.
    assert "Formatted Street" not in caplog.text


@pytest.mark.parametrize("county", ["County Cork", "Co. Cork", "Cork"])
def test_a_centre_without_an_eircode_is_found_by_address_and_county(
    database: Database, county: str
) -> None:
    _publish(database, NO_EIRCODE)
    google = FakeGoogle(
        {NO_EIRCODE.address: [found(postal_code="P31 AC34", county=county)]}
    )

    assert _geocode(google) == EXIT_DONE

    assert google.addresses == [NO_EIRCODE.address]
    assert NO_EIRCODE.centre_id in _points(database)


def test_an_address_found_in_another_county_is_not_accepted(
    database: Database, caplog: pytest.LogCaptureFixture
) -> None:
    _publish(database, NO_EIRCODE)
    google = FakeGoogle({NO_EIRCODE.address: [found(county="County Kerry")]})

    assert _geocode(google) == EXIT_DONE

    assert _points(database) == {}
    assert _logged(caplog, NO_EIRCODE.centre_id, "county")


@pytest.mark.parametrize(
    "refusal", ["REQUEST_DENIED", "INVALID_REQUEST", "OVER_DAILY_LIMIT"]
)
def test_a_refused_key_or_request_stops_the_stage(
    database: Database, refusal: str
) -> None:
    _publish(database, GALWAY, LIMERICK)
    _store_point(database, LIMERICK, days_ago=30, at=EARLY)
    google = FakeGoogle(
        {"A65 F4E2": [status(refusal)], "V94 X2Y4": [status(refusal)]}
    )

    assert _geocode(google) == EXIT_FAILED

    assert len(google.queries) == 1
    # The expired point went first, whatever Google said after.
    assert _points(database) == {}


@pytest.mark.parametrize(
    "transient",
    [
        status("OVER_QUERY_LIMIT"),
        status("UNKNOWN_ERROR"),
        http(503),
        FetchError("timed out"),
    ],
)
def test_a_transient_error_is_retried_then_left_for_the_next_run(
    database: Database, caplog: pytest.LogCaptureFixture, transient: Answer
) -> None:
    _publish(database, GALWAY, LIMERICK)
    _store_point(database, LIMERICK, days_ago=23, at=EARLY)
    google = FakeGoogle(
        {"A65 F4E2": [transient, found()], "V94 X2Y4": [transient] * 4}
    )
    sleeps: list[float] = []

    assert _geocode(google, sleeps) == EXIT_RETRY

    # One request and three retries at most, with a pause before each retry.
    assert google.addresses.count("A65 F4E2") == 2
    assert google.addresses.count("V94 X2Y4") == 4
    assert len(sleeps) == 1 + 3
    points = _points(database)
    assert points[GALWAY.centre_id][3]
    # A refresh that failed keeps the point it had.
    assert points[LIMERICK.centre_id] == OLD_POINT
    assert _logged(caplog, LIMERICK.centre_id, "unreachable")


def test_the_key_never_appears_in_the_logs(
    database: Database, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    _publish(database, GALWAY, LIMERICK, CORK)
    first = FakeGoogle(
        {
            "A65 F4E2": [found()],
            "V94 X2Y4": [found(postal_code="H91 X2Y4")],
            "T12 AC34": [FetchError("timed out")] * 4,
        }
    )
    denied = FakeGoogle(
        {
            "V94 X2Y4": [status("REQUEST_DENIED")],
            "T12 AC34": [status("REQUEST_DENIED")],
        }
    )

    assert _geocode(first) == EXIT_RETRY
    assert _geocode(denied) == EXIT_FAILED

    assert caplog.records
    assert KEY not in caplog.text
    assert "googleapis" not in caplog.text
