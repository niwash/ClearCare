import base64
import hashlib

import pytest
from botocore.stub import Stubber
from mypy_boto3_s3 import S3Client

from clearcare_pipeline.object_store import ObjectStoreError, S3ObjectStore
from clearcare_pipeline.s3_settings import S3Settings, make_s3_client

BUCKET = "clearcare-raw"


def _client() -> S3Client:
    return make_s3_client(
        S3Settings(
            endpoint="https://ns.compat.objectstorage.uk-london-1.oraclecloud.com",
            region="uk-london-1",
            bucket=BUCKET,
            access_key_id="test",
            secret_access_key="test",
        )
    )


def test_existing_keys_reads_every_page() -> None:
    client = _client()
    with Stubber(client) as stub:
        stub.add_response(
            "list_objects_v2",
            {
                "Contents": [{"Key": "raw/a"}],
                "IsTruncated": True,
                "NextContinuationToken": "page-2",
            },
            {"Bucket": BUCKET, "Prefix": "raw/"},
        )
        stub.add_response(
            "list_objects_v2",
            {"Contents": [{"Key": "raw/b"}], "IsTruncated": False},
            {"Bucket": BUCKET, "Prefix": "raw/", "ContinuationToken": "page-2"},
        )

        keys = S3ObjectStore(client, BUCKET).existing_keys("raw/")

    assert keys == frozenset({"raw/a", "raw/b"})


def test_existing_keys_of_an_empty_prefix() -> None:
    client = _client()
    with Stubber(client) as stub:
        stub.add_response(
            "list_objects_v2",
            {"IsTruncated": False},
            {"Bucket": BUCKET, "Prefix": "raw/"},
        )

        keys = S3ObjectStore(client, BUCKET).existing_keys("raw/")

    assert keys == frozenset()


def test_put_sends_the_body_with_its_md5() -> None:
    client = _client()
    body = b"Centre_ID,Centre_Title\n"
    md5 = base64.b64encode(hashlib.md5(body).digest()).decode()
    with Stubber(client) as stub:
        stub.add_response(
            "put_object",
            {},
            {"Bucket": BUCKET, "Key": "raw/x", "Body": body, "ContentMD5": md5},
        )

        S3ObjectStore(client, BUCKET).put("raw/x", body)

        stub.assert_no_pending_responses()


def test_put_failure_raises_object_store_error() -> None:
    client = _client()
    with Stubber(client) as stub:
        stub.add_client_error(
            "put_object",
            service_error_code="AccessDenied",
            http_status_code=403,
        )

        with pytest.raises(ObjectStoreError, match=r"raw/x.*AccessDenied"):
            S3ObjectStore(client, BUCKET).put("raw/x", b"body")


def test_listing_failure_raises_object_store_error() -> None:
    client = _client()
    with Stubber(client) as stub:
        stub.add_client_error(
            "list_objects_v2",
            service_error_code="NoSuchBucket",
            http_status_code=404,
        )

        with pytest.raises(ObjectStoreError, match="NoSuchBucket"):
            S3ObjectStore(client, BUCKET).existing_keys("raw/")
