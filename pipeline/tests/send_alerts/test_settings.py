"""The settings a dispatch pass runs under, read from the environment."""

import pytest

from clearcare_pipeline.send_alerts.settings import (
    Links,
    Settings,
    SettingsError,
)

ON = {
    "CLEARCARE_ALERTS": "on",
    "CLEARCARE_ALERTS_SENDER": "log",
    "CLEARCARE_SITE_URL": "https://clearcare.test/",
    "CLEARCARE_COGNITO_USER_POOL_ID": "eu-north-1_pool",
}


def test_the_gate_starts_closed() -> None:
    settings = Settings.from_env({})

    assert settings.send_enabled is False
    assert settings.sender is None
    # The account pool is still read: the setting is environment-wide.
    assert settings.region == "eu-north-1"


def test_an_open_gate_reads_every_setting_and_strips_the_slash() -> None:
    settings = Settings.from_env(ON)

    assert settings.send_enabled is True
    assert settings.sender == "log"
    assert settings.site_url == "https://clearcare.test"
    assert settings.user_pool_id == "eu-north-1_pool"


def test_an_open_gate_without_a_sender_is_refused() -> None:
    with pytest.raises(SettingsError) as error:
        Settings.from_env({**ON, "CLEARCARE_ALERTS_SENDER": ""})

    assert "CLEARCARE_ALERTS_SENDER" in str(error.value)


def test_an_open_gate_without_a_site_url_is_refused() -> None:
    with pytest.raises(SettingsError) as error:
        Settings.from_env({**ON, "CLEARCARE_SITE_URL": ""})

    assert "CLEARCARE_SITE_URL" in str(error.value)


def test_an_open_gate_without_a_pool_is_refused() -> None:
    with pytest.raises(SettingsError) as error:
        Settings.from_env({**ON, "CLEARCARE_COGNITO_USER_POOL_ID": ""})

    assert "CLEARCARE_COGNITO_USER_POOL_ID" in str(error.value)


def test_the_ses_sender_is_not_offered_until_its_ticket() -> None:
    # The SES sender is CCARE-268's; until it lands the setting is refused
    # rather than silently logging where SES was meant to send.
    with pytest.raises(SettingsError) as error:
        Settings.from_env({**ON, "CLEARCARE_ALERTS_SENDER": "ses"})

    assert "CLEARCARE_ALERTS_SENDER" in str(error.value)


@pytest.mark.parametrize(
    ("variable", "value"),
    [
        ("CLEARCARE_ALERTS", "maybe"),
        ("CLEARCARE_ALERTS_SENDER", "ses"),
    ],
)
def test_a_misdeclared_value_is_refused(variable: str, value: str) -> None:
    with pytest.raises(SettingsError):
        Settings.from_env({**ON, variable: value})


def test_a_closed_gate_ignores_the_log_sender() -> None:
    # A closed gate consumes events and owes nothing, whatever the sender
    # variable says; this build refuses "ses" outright until CCARE-268.
    settings = Settings.from_env(
        {"CLEARCARE_ALERTS": "off", "CLEARCARE_ALERTS_SENDER": "log"}
    )

    assert settings.send_enabled is False
    assert settings.sender is None


def test_the_links_are_the_site_s_url_shapes() -> None:
    links = Links("https://clearcare.test")

    assert links.centre("117") == "https://clearcare.test/centres/117"
    assert (
        links.centre_inspections("117")
        == "https://clearcare.test/centres/117/inspections"
    )
    assert (
        links.county("Carlow")
        == "https://clearcare.test/search?county=Carlow&sort=latest_inspection"
    )
    assert (
        links.search_all()
        == "https://clearcare.test/search?sort=latest_inspection"
    )
    assert (
        links.unsubscribe("t")
        == "https://clearcare.test/alerts/unsubscribe?token=t"
    )
