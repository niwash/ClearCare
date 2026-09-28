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


class SettingsError(Exception):
    """The environment does not describe a usable object store."""


@dataclass(frozen=True)
class S3Settings:
    """Where the bucket is and how to sign requests to it."""

    endpoint: str
    region: str
    bucket: str
    access_key_id: str = field(repr=False)
    secret_access_key: str = field(repr=False)

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> Self:
        """Reads the settings from CLEARCARE_S3_* variables.

        Raises:
            SettingsError: If a variable is missing or empty, or the endpoint
                is not an https URL.
        """
        missing = [name for name in _VARIABLES.values() if not env.get(name)]
        if missing:
            raise SettingsError(
                "missing environment variables: " + ", ".join(missing)
            )
        values = {attr: env[name] for attr, name in _VARIABLES.items()}
        if not values["endpoint"].startswith("https://"):
            raise SettingsError("CLEARCARE_S3_ENDPOINT must be an https URL")
        return cls(**values)


def make_s3_client(settings: S3Settings) -> "S3Client":
    """Creates an S3 client for the configured endpoint."""
    # boto3.client is overloaded for every AWS service; only the S3 types are
    # installed, so pyright sees the other overloads as unknown.
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
