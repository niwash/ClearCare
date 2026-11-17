"""The two name comparisons, against the examples measured in CCARE-209."""

import pytest

from clearcare_pipeline.match_places.names import (
    agrees,
    spelling_similarity,
    word_overlap,
)


@pytest.mark.parametrize(
    ("register", "google"),
    [
        # A name split in two.
        ("Beechlawn House Nursing Home", "Beech Lawn Nursing Home"),
        ("Oak View Nursing Home", "Oakview Nursing Home"),
        # An apostrophe.
        ("St Ursula's Nursing Home", "St Ursulas Nursing Home"),
        # An Irish initial mutation.
        ("Aras Gaoth Dobhair", "Aras Ghaoth Dobhair"),
        # An anglicised spelling.
        ("Caherciveen Community Hospital", "Cahirciveen Community Hospital"),
        # Google lists the shorter name, and the shorter name has every
        # distinctive word, so the word comparison carries it.
        ("Mount Cara Nursing Home", "Mount Cara"),
        ("Heather House Community Nursing Unit", "Heather House"),
        # The register carries a locality that Google leaves out.
        ("Nazareth House, Dublin", "Nazareth House"),
        # Punctuation that both sides spell differently.
        (
            "Joe & Helen O'Toole Community Nursing Unit",
            "Joe & Helen O'Toole Community Nursing Unit",
        ),
    ],
)
def test_the_same_centre_agrees(register: str, google: str) -> None:
    assert agrees(register, google)
    assert agrees(google, register)


@pytest.mark.parametrize(
    ("register", "google"),
    [
        # No distinctive word in common, and nothing alike as characters.
        ("Hollybrook Lodge", "Inchicore Library at Richmond Barracks"),
        ("Riada House Community Nursing Unit", "Sunflower yoga"),
    ],
)
def test_a_different_building_is_refused(register: str, google: str) -> None:
    assert not agrees(register, google)


@pytest.mark.parametrize(
    ("register", "google"),
    [
        # A marina, a church, and two other nursing homes. Each passes because
        # the generic words carry the character comparison, or because the town
        # name is the only distinctive word left. These are the 0.6% of wrong
        # matches the ADR records, and they are why the approved list is
        # reviewed by a person.
        ("Ballinasloe Care Centre", "Ballinasloe Marina"),
        ("Our Lady of Lourdes Care Facility", "Our Lady of Lourdes Church"),
        ("Aclare House Nursing Home", "Ashford House Nursing Home"),
        (
            "Merlin Park Community Nursing Unit 6",
            "St. Brendan's Community Nursing Unit",
        ),
    ],
)
def test_the_known_wrong_matches_still_pass(register: str, google: str) -> None:
    """Holds the limitation still: if one starts failing, the count moves.

    A change that makes these refuse is an improvement, but it changes how many
    centres the pipeline approves, so the proposal's figure and this test move
    together.
    """
    assert agrees(register, google)


def test_a_missing_name_agrees_with_nothing() -> None:
    assert spelling_similarity("", "") == 0.0
    assert word_overlap("", "") == 0.0
    assert not agrees("", "")
    assert not agrees("Nursing Home", "")


def test_generic_words_alone_carry_no_meaning() -> None:
    assert word_overlap("Nursing Home", "Community Hospital") == 0.0
    assert word_overlap("Mount Cara Nursing Home", "Mount Cara") == 1.0


def test_the_comparisons_are_bounded() -> None:
    for left, right in (
        ("Nazareth House", "Nazareth House"),
        ("Nazareth House", "Inchicore Library"),
        ("", "Nazareth House"),
    ):
        assert 0.0 <= spelling_similarity(left, right) <= 1.0
        assert 0.0 <= word_overlap(left, right) <= 1.0
