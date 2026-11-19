"""Command line entry point: ``python -m clearcare_pipeline.send_alerts``."""

import logging
import sys
from collections.abc import Sequence
from typing import TYPE_CHECKING

import boto3
import psycopg

from clearcare_pipeline.exit_codes import EXIT_DONE, EXIT_FAILED, EXIT_RETRY
from clearcare_pipeline.send_alerts.cognito import AddressBook
from clearcare_pipeline.send_alerts.database import Dispatcher
from clearcare_pipeline.send_alerts.email import LogSender
from clearcare_pipeline.send_alerts.run import Summary, dispatch
from clearcare_pipeline.send_alerts.settings import (
    Links,
    Settings,
    SettingsError,
)

if TYPE_CHECKING:
    from mypy_boto3_cognito_idp import CognitoIdentityProviderClient

logger = logging.getLogger(__name__)


def _cognito_client(region: str) -> "CognitoIdentityProviderClient":
    """Creates a Cognito client for the region, on the same credentials."""
    return boto3.client(  # pyright: ignore[reportUnknownMemberType]
        "cognito-idp", region_name=region
    )


def main(argv: Sequence[str] | None = None) -> int:
    """Runs one dispatch pass from the command line.

    The stage takes no options: it reads only the database (the schedule's
    download-less stages are the same, ADR-0014). The database connection
    comes from libpq's environment variables (PGHOST, PGPORT, PGDATABASE,
    PGUSER, PGPASSWORD). The gate and the sender come from the environment
    too (settings.py): a closed gate consumes the claimed events and sends
    nothing, and a misdeclared one fails the stage before the database is
    touched.

    A manual run takes no run lock (ADR-0022), so do not run it beside a
    live pipeline pass: a digest can be emailed twice, and an event can be
    marked processed while its ingest is still writing batches.
    """
    del argv  # no options: the schedule passes none, like geocode's
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    try:
        settings = Settings.from_env()
    except SettingsError as error:
        logger.error("%s", error)
        return EXIT_FAILED
    sending = None
    addresses = None
    links = None
    if settings.send_enabled:
        # A gate that is open has all of these; from_env checked them.
        assert settings.site_url is not None
        # The sender is log: settings accepts nothing else until the SES
        # sender lands with CCARE-268.
        sending = LogSender()
        addresses = AddressBook(
            _cognito_client(settings.region), settings.user_pool_id or ""
        )
        links = Links(settings.site_url)
    try:
        with psycopg.connect(autocommit=True) as connection:
            summary = dispatch(
                Dispatcher(connection), sending, addresses, links
            )
    except psycopg.Error as error:
        logger.error("database error: %s", error)
        return EXIT_FAILED
    _log(summary)
    if summary.events_left or summary.emails_failed:
        # Work the next pass retries (ADR-0022's exit 3, the run stays
        # green): more events waited than this pass claimed, and receipts
        # whose send failed carry their debt to the next attempt.
        return EXIT_RETRY
    return EXIT_DONE


def _log(summary: Summary) -> None:
    logger.info(
        "requeued %d, claimed %d, processed %d, receipts owed %d;"
        " emails sent %d, failed %d, skipped %d; %d events left for the"
        " next pass",
        summary.requeued,
        summary.claimed,
        summary.events_processed,
        summary.receipts_owed,
        summary.emails_sent,
        summary.emails_failed,
        summary.receipts_skipped,
        summary.events_left,
    )


if __name__ == "__main__":
    sys.exit(main())
