"""Command line entry point: ``python -m clearcare_pipeline.geocode``.

What it keeps from Google, and for how long: ADR-0027.
"""

import argparse
import logging
import os
import sys
import time
from collections.abc import Callable, Sequence

import psycopg

from clearcare_pipeline.exit_codes import EXIT_DONE, EXIT_FAILED, EXIT_RETRY
from clearcare_pipeline.geocode.database import (
    Connection,
    delete_expired,
    due_centres,
    store,
)
from clearcare_pipeline.geocode.google import (
    TIMEOUT_SECONDS,
    GoogleGeocoder,
    Location,
    RequestRefusedError,
)
from clearcare_pipeline.snapshots.fetch import Fetcher, UrllibFetcher

KEY_VARIABLE = "GOOGLE_GEOCODING_API_KEY"
# Checked per centre: a run asks about each of the 547 centres at most once,
# plus retries, so a few over at most. Google gives 10,000 free a month.
MAX_REQUESTS = 600

logger = logging.getLogger(__name__)


def main(
    argv: Sequence[str] | None = None,
    fetcher: Fetcher | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> int:
    """Deletes expired points, then geocodes the centres that are due.

    The database connection comes from libpq's environment variables
    (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD), and Google's key from
    GOOGLE_GEOCODING_API_KEY. Without the key only the deletion runs.
    """
    parser = argparse.ArgumentParser(
        description="Geocode the centres whose point is missing or old."
    )
    parser.parse_args(argv)
    try:
        # Autocommit, so the deletion and each point stand on their own.
        with psycopg.connect(autocommit=True) as connection:
            return _run(connection, fetcher, sleep)
    except psycopg.Error as error:
        logger.error("%s", error)
        return EXIT_FAILED


def _run(
    connection: Connection,
    fetcher: Fetcher | None,
    sleep: Callable[[float], None],
) -> int:
    # First, and whatever happens after it, so that neither a missing key nor
    # a failure at Google keeps a point past its 30 days.
    deleted = delete_expired(connection)
    logger.info("deleted %d points 30 or more calendar days old", deleted)
    key = os.environ.get(KEY_VARIABLE)
    if not key:
        logger.info("%s is not set, so geocoding is off", KEY_VARIABLE)
        return EXIT_DONE
    geocoder = GoogleGeocoder(
        key, fetcher or UrllibFetcher(timeout=TIMEOUT_SECONDS), sleep
    )
    due = due_centres(connection)
    stored = refused = unreached = 0
    for centre in due:
        if geocoder.requests >= MAX_REQUESTS:
            break
        try:
            answer = geocoder.locate(centre)
        except RequestRefusedError as refusal:
            logger.error(
                "Google refused the request (%s); check the key and the API"
                " it is limited to",
                refusal,
            )
            return EXIT_FAILED
        if isinstance(answer, Location):
            store(connection, centre.centre_id, answer)
            stored += 1
            continue
        logger.warning(
            "centre %s unresolved: %s", centre.centre_id, answer.reason
        )
        if answer.reached:
            refused += 1
        else:
            unreached += 1
    left = len(due) - stored - refused - unreached
    logger.info(
        "%d centres due: %d stored, %d refused, %d not reached, %d left at"
        " the cap of %d requests",
        len(due),
        stored,
        refused,
        unreached,
        left,
        MAX_REQUESTS,
    )
    # Every centre without a point is asked again on the next run. Only those
    # Google never answered, or the cap left out, make this run incomplete: a
    # refused answer is logged, and asking again soon is unlikely to change it.
    return EXIT_RETRY if unreached or left else EXIT_DONE


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    sys.exit(main())
