"""The digest the dispatcher composes, from the receipts' sections."""

from clearcare_pipeline.send_alerts.email import SUBJECT, Names, compose
from clearcare_pipeline.send_alerts.settings import Links

NAMES = Names(
    centres={
        "108": "The Marlay Nursing Home",
        "117": "Firstcare Beneavin Lodge",
        "187": "Abbeylands Nursing Home",
    },
    counties={6: "Dublin", 4: "Cork"},
)
LINKS = Links("https://clearcare.test")
UNSUBSCRIBE = "https://clearcare.test/alerts/unsubscribe?token=t"

MIXED: dict[str, list[dict[str, object]]] = {
    "CENTRE": [
        {"centre_id": "108"},
        {"centre_id": "117"},
        {"centre_id": "187"},
    ],
    "COUNTY": [{"county_id": 6}, {"county_id": 4}],
    "ALL": [],
}
CENTRES_ONLY: dict[str, list[dict[str, object]]] = {
    "CENTRE": [{"centre_id": "108"}, {"centre_id": "117"}]
}
COUNTIES_ONLY: dict[str, list[dict[str, object]]] = {
    "COUNTY": [{"county_id": 6}, {"county_id": 4}]
}
ALL_ONLY: dict[str, list[dict[str, object]]] = {"ALL": []}


def test_the_subject_names_the_site_and_what_happened() -> None:
    assert SUBJECT == "New inspection reports published | ClearCare"


def test_the_mixed_digest_has_every_section_with_clickable_targets() -> None:
    text, html = compose(MIXED, NAMES, LINKS, UNSUBSCRIBE)

    # The plain text spells each address out after its name.
    assert (
        "Hi,\n\nThere are new inspection reports available on ClearCare."
        in text
    )
    assert (
        "We've found new reports matching the nursing homes and counties"
        " you follow, as well as new publications across the site."
    ) in text
    assert "Reports from centres you follow" in text
    assert (
        "The Marlay Nursing Home: https://clearcare.test/centres/108/inspections"
        in text
    )
    assert "Reports from counties you follow" in text
    assert (
        "Dublin: https://clearcare.test/search?county=Dublin&sort=latest_inspection"
        in text
    )
    assert "New reports across Ireland" in text
    assert (
        "New inspection reports have also been published across other areas."
        in text
    )
    assert (
        "Visit ClearCare to explore the latest inspection reports and see"
        " what's been published: https://clearcare.test/search?sort=latest_inspection"
        in text
    )
    assert f"Unsubscribe from all alerts: {UNSUBSCRIBE}" in text
    assert text.endswith("Thanks,\nThe ClearCare Team")

    # The HTML part carries the same digest with clickable text.
    assert '<a href="https://clearcare.test/centres/108/inspections">' in html
    assert ">The Marlay Nursing Home</a>" in html
    assert (
        'href="https://clearcare.test/search?county=Dublin&amp;'
        "sort=latest_inspection" in html
    )
    assert ">Unsubscribe from all alerts</a>" in html
    assert "Thanks,<br>The ClearCare Team" in html


def test_sections_the_account_does_not_hold_are_left_out() -> None:
    text, html = compose(CENTRES_ONLY, NAMES, LINKS, UNSUBSCRIBE)

    assert (
        "We've found new reports matching the nursing homes you follow." in text
    )
    assert "counties" not in text.split("Hi,")[1].split("\n\n")[2]
    assert "Reports from counties you follow" not in text
    assert "New reports across Ireland" not in text
    # A digest of centres alone is already all links: no Stay informed block.
    assert "Stay informed" not in text
    assert "Stay informed" not in html
    assert "Reports from centres you follow" in html


def test_the_county_only_digest_names_counties_alone() -> None:
    text, _html = compose(COUNTIES_ONLY, NAMES, LINKS, UNSUBSCRIBE)

    assert "We've found new reports matching the counties you follow." in text
    assert (
        "Cork: https://clearcare.test/search?county=Cork&sort=latest_inspection"
        in text
    )
    assert "Reports from centres you follow" not in text


def test_the_all_only_digest_is_the_generic_across_ireland_line() -> None:
    text, html = compose(ALL_ONLY, NAMES, LINKS, UNSUBSCRIBE)

    # No matching sentence: the greeting and the section say it all.
    assert "We've found new reports matching" not in text
    assert "New reports across Ireland" in text
    assert "New inspection reports have been published across the site." in text
    # Without other sections there is no "also".
    assert "also been published across other areas" not in text
    # The all-reports section carries no links, so the block stays here.
    assert "Stay informed" in text
    assert "New reports across Ireland" in html


def test_the_all_section_gains_its_alongside_wording_in_a_mixed_digest() -> (
    None
):
    text, _html = compose(MIXED, NAMES, LINKS, UNSUBSCRIBE)

    assert (
        "New inspection reports have also been published across other areas."
        in text
    )


def test_a_target_several_runs_touched_is_named_once() -> None:
    text, html = compose(
        {
            "CENTRE": [
                {"centre_id": "108"},
                {"centre_id": "108"},
                {"centre_id": "117"},
            ]
        },
        NAMES,
        LINKS,
        UNSUBSCRIBE,
    )

    assert text.count("The Marlay Nursing Home") == 1
    assert html.count("The Marlay Nursing Home") == 1


def test_a_centre_without_a_name_spells_the_hiqa_id() -> None:
    text, _html = compose(
        {"CENTRE": [{"centre_id": "238"}]}, NAMES, LINKS, UNSUBSCRIBE
    )

    assert "centre 238: https://clearcare.test/centres/238/inspections" in text


def test_the_html_escapes_what_the_register_carries() -> None:
    names = Names(
        centres={"117": "St. Joseph's Centre & Mary's"},
        counties={6: "Dublin"},
    )
    text, html = compose(
        {"CENTRE": [{"centre_id": "117"}]}, names, LINKS, UNSUBSCRIBE
    )

    # The plain text shows the raw name; the HTML escapes it.
    assert "St. Joseph's Centre & Mary's" in text
    assert "St. Joseph&#x27;s Centre &amp; Mary&#x27;s" in html
