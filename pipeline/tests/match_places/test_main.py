"""The stage: which listing it stores, which it refuses, and when it stops."""

from typing import cast

import pytest

from clearcare_pipeline.exit_codes import EXIT_DONE, EXIT_FAILED
from clearcare_pipeline.match_places.__main__ import KEY_VARIABLE, choose, run
from clearcare_pipeline.match_places.database import Connection
from clearcare_pipeline.match_places.places import Candidate, Centre
from tests.match_places.fakes import (
    FakeConnection,
    FakeTransport,
    answer,
    empty,
    malformed,
    place,
    refusal,
)

CENTRE = Centre(
    centre_id="1",
    name="Mount Cara Nursing Home",
    address="Blackrock, Cork, T12 X123",
    county="Cork",
    latitude=51.9,
    longitude=-8.4,
)
SECOND = Centre(
    centre_id="2",
    name="Mount Cara Nursing Home",
    address="Blackrock, Cork, T12 X123",
    county="Cork",
    latitude=51.9,
    longitude=-8.4,
)


def no_pause(_seconds: float) -> None:
    """A sleep that does not sleep, so a retry does not slow the tests."""
    return None


def database(*centres: Centre) -> FakeConnection:
    """A connection whose due query answers with these centres."""
    return FakeConnection(
        [
            (
                centre.centre_id,
                centre.name,
                centre.address,
                centre.county,
                centre.latitude,
                centre.longitude,
            )
            for centre in centres
        ]
    )


def as_connection(fake: FakeConnection) -> Connection:
    """The stage's connection, as the fake that answers instead of psycopg."""
    return cast(Connection, fake)


def candidate(
    place_id: str,
    name: str,
    latitude: float = 51.9,
    longitude: float = -8.4,
    photos: int = 3,
) -> Candidate:
    """One listing, with the fields the choice uses."""
    return Candidate(place_id, name, latitude, longitude, photos)


def test_the_near_listing_beats_a_better_named_one_far_away() -> None:
    near = candidate("near", "Mount Cara", 51.9001, -8.4001)
    far = candidate("far", "Mount Cara Nursing Home", 52.2, -8.4)
    chosen = choose(CENTRE, [far, near])
    assert not isinstance(chosen, str)
    assert chosen[0].place_id == "near"


def test_a_different_building_is_refused() -> None:
    library = candidate("lib", "Inchicore Library at Richmond Barracks")
    assert choose(CENTRE, [library]) == "name"


def test_a_namesake_far_away_is_refused() -> None:
    namesake = candidate("far", "Mount Cara Nursing Home", 53.4, -6.2)
    assert choose(CENTRE, [namesake]) == "far"


def test_a_listing_with_no_photo_is_refused() -> None:
    photoless = candidate("none", "Mount Cara Nursing Home", photos=0)
    assert choose(CENTRE, [photoless]) == "no_photo"


def test_no_candidate_at_all_is_no_listing() -> None:
    assert choose(CENTRE, []) == "no_listing"


def test_it_stores_only_what_passes(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(KEY_VARIABLE, "key")
    fake = database(CENTRE)
    transport = FakeTransport(
        [
            answer(
                place(
                    "ChIJ1",
                    "Mount Cara Nursing Home",
                    latitude=51.9,
                    longitude=-8.4,
                )
            )
        ]
    )
    code = run(as_connection(fake), transport, no_pause, None, False)
    assert code == EXIT_DONE
    assert fake.writes == [("1", "ChIJ1")]


def test_a_rejected_centre_writes_nothing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(KEY_VARIABLE, "key")
    fake = database(CENTRE)
    transport = FakeTransport([answer(place("ChIJ9", "Inchicore Library"))])
    code = run(as_connection(fake), transport, no_pause, None, False)
    assert code == EXIT_DONE
    assert fake.writes == []


def test_a_dry_run_writes_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(KEY_VARIABLE, "key")
    fake = database(CENTRE)
    transport = FakeTransport(
        [answer(place("ChIJ1", "Mount Cara Nursing Home"))]
    )
    code = run(as_connection(fake), transport, no_pause, None, True)
    assert code == EXIT_DONE
    assert fake.writes == []


def test_without_a_key_it_asks_google_nothing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(KEY_VARIABLE, raising=False)
    fake = database(CENTRE)
    transport = FakeTransport([])
    code = run(as_connection(fake), transport, no_pause, None, False)
    assert code == EXIT_DONE
    assert transport.urls == []
    assert fake.writes == []


def test_a_refused_key_fails_the_run(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(KEY_VARIABLE, "key")
    fake = database(CENTRE)
    transport = FakeTransport([refusal(403)])
    assert run(as_connection(fake), transport, no_pause, None, False) == (
        EXIT_FAILED
    )


def test_a_limit_asks_about_the_first_centres_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(KEY_VARIABLE, "key")
    fake = database(CENTRE, SECOND)
    transport = FakeTransport(
        [answer(place("ChIJ1", "Mount Cara Nursing Home"))]
    )
    run(as_connection(fake), transport, no_pause, 1, False)
    assert len(transport.urls) == 1


def test_a_centre_with_no_listing_does_not_stop_the_next(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(KEY_VARIABLE, "key")
    fake = database(CENTRE, SECOND)
    transport = FakeTransport(
        [
            empty(),
            answer(
                place(
                    "ChIJ2",
                    "Mount Cara Nursing Home",
                    latitude=51.9,
                    longitude=-8.4,
                )
            ),
        ]
    )
    code = run(as_connection(fake), transport, no_pause, None, False)
    assert code == EXIT_DONE
    assert fake.writes == [("2", "ChIJ2")]


def test_listings_with_no_point_are_left_alone(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(KEY_VARIABLE, "key")
    fake = database(CENTRE)
    unusable = place("ChIJ1", "Mount Cara Nursing Home")
    unusable.pop("location")
    transport = FakeTransport([answer(unusable)])
    code = run(as_connection(fake), transport, no_pause, None, False)
    assert code == EXIT_DONE
    assert fake.writes == []


def test_an_unreadable_answer_is_left_for_the_next_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(KEY_VARIABLE, "key")
    fake = database(CENTRE)
    transport = FakeTransport([malformed()])
    code = run(as_connection(fake), transport, no_pause, None, False)
    assert code == EXIT_DONE
    assert fake.writes == []
