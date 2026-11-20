"""The two senders: the log stand-in and SESv2, as botocore records it."""

import logging

import boto3
import pytest
from botocore.exceptions import ClientError
from botocore.stub import Stubber

from clearcare_pipeline.send_alerts.email import LogSender, SesSender

FROM = "ClearCare <alerts@clearcare.test>"


def test_the_log_sender_logs_the_email_but_never_the_address(
    caplog: pytest.LogCaptureFixture,
) -> None:
    sender = LogSender()

    with caplog.at_level(logging.INFO):
        first = sender.send(
            "someone@clearcare.test", "Subject here", "Text body", "<p>Html</p>"
        )
        second = sender.send(
            "someone@clearcare.test",
            "Subject again",
            "Text again",
            "<p>Html</p>",
        )

    assert (first, second) == ("log-000001", "log-000002")
    assert "Subject here" in caplog.text
    assert "Text body" in caplog.text
    # The address never appears: ADR-0034 fixes that boundary for logs too.
    assert "someone@clearcare.test" not in caplog.text


def test_the_log_sender_redacts_the_unsubscribe_token(
    caplog: pytest.LogCaptureFixture,
) -> None:
    sender = LogSender()
    body = (
        "Reports from centres you follow\n\n"
        "  The Marlay Nursing Home: https://clearcare.test/centres/108\n\n"
        "Unsubscribe from all alerts: "
        "https://clearcare.test/alerts/unsubscribe?token=secret-token\n"
    )

    with caplog.at_level(logging.INFO):
        sender.send("someone@clearcare.test", "Subject", body, "<p>h</p>")

    # The token is a capability: it stays out of logs others can read.
    assert "Unsubscribe from all alerts: [redacted]" in caplog.text
    assert "secret-token" not in caplog.text
    assert "The Marlay Nursing Home" in caplog.text


def test_the_ses_sender_sends_both_parts_and_returns_the_message_id() -> None:
    # boto3.client is overloaded per service; only the installed stubs'
    # types are known, so pyright sees the others as unknown.
    client = boto3.client(  # pyright: ignore[reportUnknownMemberType]
        "sesv2",
        region_name="eu-north-1",
        aws_access_key_id="testing",
        aws_secret_access_key="testing",
    )
    with Stubber(client) as stub:
        stub.add_response(
            "send_email",
            {"MessageId": "ses-0001"},
            expected_params={
                "FromEmailAddress": FROM,
                "Destination": {"ToAddresses": ["someone@clearcare.test"]},
                "Content": {
                    "Simple": {
                        "Subject": {"Data": "Subject here", "Charset": "UTF-8"},
                        "Body": {
                            "Text": {"Data": "Text body", "Charset": "UTF-8"},
                            "Html": {"Data": "<p>Html</p>", "Charset": "UTF-8"},
                        },
                    }
                },
            },
        )
        message_id = SesSender(client, FROM).send(
            "someone@clearcare.test", "Subject here", "Text body", "<p>Html</p>"
        )

    assert message_id == "ses-0001"


def test_the_ses_sender_raises_when_ses_refuses() -> None:
    client = boto3.client(  # pyright: ignore[reportUnknownMemberType]
        "sesv2",
        region_name="eu-north-1",
        aws_access_key_id="testing",
        aws_secret_access_key="testing",
    )
    with Stubber(client) as stub:
        stub.add_client_error(
            "send_email", service_error_code="MessageRejected"
        )
        with pytest.raises(ClientError):
            SesSender(client, FROM).send(
                "someone@clearcare.test", "s", "t", "<p>h</p>"
            )
