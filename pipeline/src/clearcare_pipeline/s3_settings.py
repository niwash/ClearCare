"""Settings for the S3-compatible object store, read from the environment."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Self

import boto3
from botocore.config import Config

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

_VARIABLES = {
    "endpoint": "CLEARCARE_S3_ENDPOINT",
    "region": "CLEARCARE_S3_REGION",
    "bucket": "CLEARCARE_S3_BUCKET",
    "access_key_id": "CLEARCARE_S3_ACCESS_KEY_ID",
    "secret_access_key": "CLEARCARE_S3_SECRET_ACCESS_KEY",
}
_AUTH = "CLEARCARE_S3_AUTH"


class SettingsError(Exception):
    """The environment does not describe a usable object store."""


@dataclass(frozen=True)
class S3Settings:
    """Where the bucket is and how to sign requests to it.

    Without an endpoint and keys, the bucket is in AWS and boto3 finds the
    credentials itself, such as an ECS task role's.
    """

    endpoint: str | None
    region: str
    bucket: str
    access_key_id: str | None = field(repr=False)
    secret_access_key: str | None = field(repr=False)

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> Self:
        """Reads the settings from CLEARCARE_S3_* variables.

        CLEARCARE_S3_AUTH=default needs only the region and the bucket.
        Otherwise all five variables are needed.

        Raises:
            SettingsError: If a variable is missing or empty, the endpoint
                is not an https URL, or CLEARCARE_S3_AUTH is unknown or comes
                with an endpoint or keys.
        """
        auth = env.get(_AUTH)
        if auth and auth != "default":
            raise SettingsError(
                f"{_AUTH} must be default or unset, got {auth!r}"
            )
        required = ("region", "bucket") if auth else tuple(_VARIABLES)
        missing = [
            _VARIABLES[attr]
            for attr in required
            if not env.get(_VARIABLES[attr])
        ]
        if missing:
            raise SettingsError(
                "missing environment variables: " + ", ".join(missing)
            )
        if auth:
            given = [
                name
                for attr, name in _VARIABLES.items()
                if attr not in required and env.get(name)
            ]
            if given:
                raise SettingsError(
                    f"{_AUTH}=default uses the credentials boto3 finds; unset "
                    + ", ".join(given)
                )
            return cls(
                endpoint=None,
                region=env[_VARIABLES["region"]],
                bucket=env[_VARIABLES["bucket"]],
                access_key_id=None,
                secret_access_key=None,
            )
        values = {attr: env[name] for attr, name in _VARIABLES.items()}
        if not values["endpoint"].startswith("https://"):
            raise SettingsError("CLEARCARE_S3_ENDPOINT must be an https URL")
        return cls(**values)


def make_s3_client(settings: S3Settings) -> "S3Client":
    """Creates an S3 client for the configured endpoint."""
    # boto3.client is overloaded for every AWS service; only the S3 types are
    # installed, so pyright sees the other overloads as unknown.
    if settings.endpoint is None:
        # On ECS the default chain reads the task role's credentials and
        # renews them before they expire.
        return boto3.client(  # pyright: ignore[reportUnknownMemberType]
            "s3", region_name=settings.region
        )
    return boto3.client(  # pyright: ignore[reportUnknownMemberType]
        "s3",
        endpoint_url=settings.endpoint,
        region_name=settings.region,
        aws_access_key_id=settings.access_key_id,
        aws_secret_access_key=settings.secret_access_key,
        # OCI documents path-style URLs for its S3 compatibility API, and not
        # every S3-compatible store accepts the checksums botocore adds by
        # default since 1.36, so they are sent only where S3 requires them.
        config=Config(
            s3={"addressing_style": "path"},
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    )
