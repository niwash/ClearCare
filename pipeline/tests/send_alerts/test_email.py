"""The sender the dispatcher holds today: the log stand-in."""

import logging

import pytest

from clearcare_pipeline.send_alerts.email import LogSender


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
