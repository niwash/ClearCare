import pytest

from clearcare_pipeline.s3_settings import (
    S3Settings,
    SettingsError,
    make_s3_client,
)

ENDPOINT = "https://ns.compat.objectstorage.uk-london-1.oraclecloud.com"
VALID_ENV = {
    "CLEARCARE_S3_ENDPOINT": ENDPOINT,
    "CLEARCARE_S3_REGION": "uk-london-1",
    "CLEARCARE_S3_BUCKET": "clearcare-raw",
    "CLEARCARE_S3_ACCESS_KEY_ID": "key-id-value",
    "CLEARCARE_S3_SECRET_ACCESS_KEY": "secret-value",
}


def test_settings_are_read_from_the_environment() -> None:
    settings = S3Settings.from_env(VALID_ENV)

    assert settings.endpoint == ENDPOINT
    assert settings.region == "uk-london-1"
    assert settings.bucket == "clearcare-raw"
    assert settings.access_key_id == "key-id-value"
    assert settings.secret_access_key == "secret-value"


def test_every_missing_or_empty_variable_is_named() -> None:
    env = {
        **VALID_ENV,
        "CLEARCARE_S3_BUCKET": "",
        "CLEARCARE_S3_SECRET_ACCESS_KEY": "",
    }
    del env["CLEARCARE_S3_REGION"]

    with pytest.raises(SettingsError) as raised:
        S3Settings.from_env(env)

    message = str(raised.value)
    assert "CLEARCARE_S3_BUCKET" in message
    assert "CLEARCARE_S3_REGION" in message
    assert "CLEARCARE_S3_SECRET_ACCESS_KEY" in message
    assert "CLEARCARE_S3_ENDPOINT" not in message


def test_endpoint_must_use_https() -> None:
    env = {**VALID_ENV, "CLEARCARE_S3_ENDPOINT": "http://insecure.example"}

    with pytest.raises(SettingsError, match="https"):
        S3Settings.from_env(env)


def test_credentials_never_appear_in_the_representation() -> None:
    text = repr(S3Settings.from_env(VALID_ENV))

    assert "key-id-value" not in text
    assert "secret-value" not in text


def test_client_uses_the_endpoint_with_path_style_addressing() -> None:
    client = make_s3_client(S3Settings.from_env(VALID_ENV))

    assert client.meta.endpoint_url == ENDPOINT
    assert client.meta.region_name == "uk-london-1"
    options = vars(client.meta.config)
    assert options["s3"] == {"addressing_style": "path"}
    assert options["request_checksum_calculation"] == "when_required"
