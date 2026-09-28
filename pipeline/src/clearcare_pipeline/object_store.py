"""Remote object storage that keeps copies of raw files (ADR-0007)."""

import base64
import hashlib
from typing import TYPE_CHECKING, Protocol

from botocore.exceptions import BotoCoreError, ClientError

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client


class ObjectStoreError(Exception):
    """A request to the object store failed."""


class ObjectStore(Protocol):
    """A bucket of objects addressed by key."""

    def existing_keys(self, prefix: str) -> frozenset[str]:
        """Returns every key that starts with the prefix."""
        ...

    def put(self, key: str, body: bytes) -> None:
        """Stores the body under the key."""
        ...


class S3ObjectStore:
    """Object store reached through an S3-compatible API."""

    def __init__(self, client: "S3Client", bucket: str) -> None:
        """Creates a store for one bucket."""
        self._client = client
        self._bucket = bucket

    def existing_keys(self, prefix: str) -> frozenset[str]:
        """Returns every key that starts with the prefix.

        Raises:
            ObjectStoreError: If the bucket cannot be listed.
        """
        paginator = self._client.get_paginator("list_objects_v2")
        try:
            return frozenset(
                key
                for page in paginator.paginate(
                    Bucket=self._bucket, Prefix=prefix
                )
                for item in page.get("Contents", [])
                if (key := item.get("Key")) is not None
            )
        except (BotoCoreError, ClientError) as error:
            raise ObjectStoreError(f"listing {prefix}: {error}") from error

    def put(self, key: str, body: bytes) -> None:
        """Stores the body, letting the server verify it against its MD5.

        Raises:
            ObjectStoreError: If the object was not stored.
        """
        md5 = hashlib.md5(body, usedforsecurity=False).digest()
        try:
            self._client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=body,
                ContentMD5=base64.b64encode(md5).decode(),
            )
        except (BotoCoreError, ClientError) as error:
            raise ObjectStoreError(f"{key}: {error}") from error
