"""The address book, as Cognito answers through botocore's stub."""

import boto3
import pytest
from botocore.exceptions import ClientError
from botocore.stub import Stubber

from clearcare_pipeline.send_alerts.cognito import AddressBook

POOL = "eu-north-1_pool"
SUB = "sub-one"


def _book(*responses: object) -> tuple[AddressBook, Stubber]:
    # boto3.client is overloaded per service; only the installed stubs'
    # types are known, so pyright sees the others as unknown.
    client = boto3.client(  # pyright: ignore[reportUnknownMemberType]
        "cognito-idp",
        region_name="eu-north-1",
        aws_access_key_id="testing",
        aws_secret_access_key="testing",
    )
    stub = Stubber(client)
    for response in responses:
        if isinstance(response, str):
            stub.add_client_error("admin_get_user", service_error_code=response)
        else:
            stub.add_response(
                "admin_get_user",
                response,  # type: ignore[arg-type]
                expected_params={"UserPoolId": POOL, "Username": SUB},
            )
    return AddressBook(client, POOL), stub


def test_the_address_is_the_account_s_email_attribute() -> None:
    book, stub = _book(
        {
            "Username": SUB,
            "UserAttributes": [
                {"Name": "sub", "Value": SUB},
                {"Name": "email", "Value": "someone@clearcare.test"},
                {"Name": "email_verified", "Value": "true"},
            ],
        }
    )
    with stub:
        assert book.address(SUB) == "someone@clearcare.test"
        # Asked once per pass: the second ask is the cache, and the stub
        # would refuse a second real call.
        assert book.address(SUB) == "someone@clearcare.test"


def test_a_subject_cognito_does_not_know_resolves_to_none() -> None:
    book, stub = _book("UserNotFoundException")
    with stub:
        assert book.address(SUB) is None
        assert book.address(SUB) is None


def test_an_account_without_an_email_resolves_to_none() -> None:
    book, stub = _book(
        {
            "Username": SUB,
            "UserAttributes": [{"Name": "sub", "Value": SUB}],
        }
    )
    with stub:
        assert book.address(SUB) is None


def test_cognito_being_down_raises_and_is_retried_with_the_send() -> None:
    book, stub = _book("TooManyRequestsException")
    with stub, pytest.raises(ClientError):
        book.address(SUB)
