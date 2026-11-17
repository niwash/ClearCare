"""The Places client: what it asks, and what it makes of the answer."""

from collections.abc import Sequence

import pytest

from clearcare_pipeline.match_places.places import (
    Centre,
    PlacesClient,
    RequestRefusedError,
    Unresolved,
)
from clearcare_pipeline.snapshots.fetch import FetchError, FetchResult
from tests.match_places.fakes import (
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


def no_pause(_seconds: float) -> None:
    """A sleep that does not sleep, so a retry does not slow the tests."""
    return None


def build(
    answers: Sequence[FetchResult | FetchError],
    pauses: list[float] | None = None,
) -> tuple[PlacesClient, FakeTransport]:
    """A client whose transport answers from the list, and its transport."""
    transport = FakeTransport(answers)
    sleep = pauses.append if pauses is not None else no_pause
    return PlacesClient("key", transport, sleep), transport


def test_it_asks_for_the_name_the_address_and_ireland() -> None:
    client, transport = build([empty()])
    client.candidates(CENTRE)
    assert transport.bodies == [
        {
            "textQuery": (
                "Mount Cara Nursing Home, Blackrock, Cork, T12 X123, Ireland"
            ),
            "regionCode": "IE",
            "pageSize": 5,
        }
    ]


def test_the_key_travels_in_a_header_and_not_the_url() -> None:
    client, transport = build([empty()])
    client.candidates(CENTRE)
    assert "key" not in transport.urls[0]
    assert transport.headers[0]["X-Goog-Api-Key"] == "key"
    assert transport.headers[0]["X-Goog-FieldMask"].startswith("places.id")


def test_a_listing_becomes_a_candidate() -> None:
    client, _ = build([answer(place("ChIJ1", "Mount Cara", photos=4))])
    candidates = client.candidates(CENTRE)
    assert isinstance(candidates, list)
    assert [candidate.place_id for candidate in candidates] == ["ChIJ1"]
    assert candidates[0].photo_count == 4
    assert candidates[0].name == "Mount Cara"


def test_a_listing_with_no_photos_has_none() -> None:
    client, _ = build([answer(place("ChIJ1", "Mount Cara", photos=0))])
    candidates = client.candidates(CENTRE)
    assert isinstance(candidates, list)
    assert candidates[0].photo_count == 0


def test_an_answer_with_no_places_is_no_listing() -> None:
    client, _ = build([empty()])
    assert client.candidates(CENTRE) == []


def test_a_listing_without_a_point_is_no_use() -> None:
    listing = place("ChIJ1", "Mount Cara")
    listing.pop("location")
    client, _ = build([answer(listing)])
    assert client.candidates(CENTRE) == Unresolved("no_location")


def test_a_malformed_body_is_not_a_refusal() -> None:
    client, _ = build([malformed()])
    assert client.candidates(CENTRE) == Unresolved("malformed")


def test_a_busy_google_is_tried_again() -> None:
    client, _ = build([refusal(429), answer(place("ChIJ1", "Mount Cara"))])
    candidates = client.candidates(CENTRE)
    assert isinstance(candidates, list)
    assert client.requests == 2


def test_a_dropped_connection_is_tried_again() -> None:
    client, _ = build(
        [FetchError("connection reset"), answer(place("ChIJ1", "Mount Cara"))]
    )
    candidates = client.candidates(CENTRE)
    assert isinstance(candidates, list)
    assert client.requests == 2


def test_the_pause_doubles_between_attempts() -> None:
    pauses: list[float] = []
    client, _ = build(
        [
            refusal(503),
            refusal(503),
            answer(place("ChIJ1", "Mount Cara")),
        ],
        pauses,
    )
    client.candidates(CENTRE)
    assert pauses == [1.0, 2.0]


def test_a_refused_key_stops_the_run() -> None:
    client, _ = build([refusal(403)])
    with pytest.raises(RequestRefusedError):
        client.candidates(CENTRE)


def test_a_google_that_never_answers_is_unreached() -> None:
    client, _ = build([refusal(429), refusal(429), refusal(429), refusal(429)])
    assert client.candidates(CENTRE) == Unresolved("unreachable", reached=False)
    assert client.requests == 4
