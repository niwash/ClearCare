"""Command line entry point: ``python -m clearcare_pipeline.match_places``.

What is stored, and for how long: ADR-0030. Which homes may show a photo, and
why: CCARE-209's proposal.
"""

import argparse
import logging
import math
import os
import sys
import time
from collections.abc import Callable, Sequence

import psycopg

from clearcare_pipeline.exit_codes import EXIT_DONE, EXIT_FAILED, EXIT_RETRY
from clearcare_pipeline.match_places.database import (
    Connection,
    due_centres,
    store,
)
from clearcare_pipeline.match_places.names import (
    agrees,
    spelling_similarity,
    word_overlap,
)
from clearcare_pipeline.match_places.places import (
    Candidate,
    Centre,
    PlacesClient,
    RequestRefusedError,
    Transport,
    Unresolved,
    UrllibTransport,
)

KEY_VARIABLE = "GOOGLE_PLACES_API_KEY"
# A run asks about each centre at most once, plus retries, so a few over the
# 546 at most. Google gives 5,000 free a month.
MAX_REQUESTS = 600
# Unanswered, a centre takes 4 tries of 10 s and 7 s of pauses, about 47 s:
# the 150 the cap allows would hold the run up for two hours.
MAX_UNREACHED_IN_A_ROW = 5
# The register's Eircode point is a postal centroid, not the building, so a
# correct listing can sit a few hundred metres from it (CCARE-209).
MAX_DISTANCE_M = 300
EARTH_RADIUS_M = 6_371_000.0

logger = logging.getLogger(__name__)


def main(
    argv: Sequence[str] | None = None,
    transport: Transport | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> int:
    """Finds and stores the listing that belongs to each centre that is due.

    The database connection comes from libpq's environment variables (PGHOST,
    PGPORT, PGDATABASE, PGUSER, PGPASSWORD), and Google's key from
    GOOGLE_PLACES_API_KEY. Without the key nothing is matched.
    """
    parser = argparse.ArgumentParser(
        description="Store the Google listing that belongs to each centre."
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="ask about at most N centres, the earliest centre_id first",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="ask Google and report, but write nothing",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        dest="everything",
        help=(
            "ask about every centre whose point is still inside Google's"
            " thirty days, not only those geocoded today: the first run, and"
            " a re-match after the rule changes"
        ),
    )
    args = parser.parse_args(argv)
    try:
        # Autocommit, so each stored listing stands on its own.
        with psycopg.connect(autocommit=True) as connection:
            return run(
                connection,
                transport,
                sleep,
                args.limit,
                args.dry_run,
                args.everything,
            )
    except psycopg.Error as error:
        logger.error("%s", error)
        return EXIT_FAILED


def run(
    connection: Connection,
    transport: Transport | None,
    sleep: Callable[[float], None],
    limit: int | None,
    dry_run: bool,
    everything: bool = False,
) -> int:
    """Matches the centres that are due, and returns the stage's exit code."""
    due = due_centres(connection, everything)
    if limit is not None:
        due = due[:limit]
    key = os.environ.get(KEY_VARIABLE)
    if not key:
        logger.info(
            "%d centres due, but %s is not set, so matching is off",
            len(due),
            KEY_VARIABLE,
        )
        return EXIT_DONE
    client = PlacesClient(key, transport or UrllibTransport(), sleep)
    stored = rejected = unreached = unreached_in_a_row = 0
    for centre in due:
        if client.requests >= MAX_REQUESTS:
            break
        if unreached_in_a_row >= MAX_UNREACHED_IN_A_ROW:
            logger.warning(
                "Google did not answer about %d centres in a row; the rest"
                " wait for the next run",
                unreached_in_a_row,
            )
            break
        try:
            answer = client.candidates(centre)
        except RequestRefusedError as refusal:
            logger.error(
                "Google refused the request (%s); check the key and the API"
                " it is limited to",
                refusal,
            )
            return EXIT_FAILED
        if isinstance(answer, Unresolved):
            logger.warning(
                "centre %s unresolved: %s", centre.centre_id, answer.reason
            )
            if not answer.reached:
                unreached += 1
                unreached_in_a_row += 1
                continue
            # Google answered, so the run of unanswered centres ends here.
            unreached_in_a_row = 0
            rejected += 1
            continue
        # Any answer, accepted or refused, ends a run of unanswered centres.
        unreached_in_a_row = 0
        choice = choose(centre, answer)
        if isinstance(choice, str):
            logger.info("centre %s not shown: %s", centre.centre_id, choice)
            rejected += 1
            continue
        candidate, distance = choice
        if dry_run:
            logger.info(
                "centre %s would store %s (%d m)",
                centre.centre_id,
                candidate.place_id,
                distance,
            )
        else:
            store(connection, centre.centre_id, candidate.place_id)
        stored += 1
    left = len(due) - stored - rejected - unreached
    logger.info(
        "%d centres due: %d %s, %d not shown, %d not reached, %d not asked",
        len(due),
        stored,
        "would store" if dry_run else "stored",
        rejected,
        unreached,
        left,
    )
    # Every centre without a listing is asked again on the next run. Only those
    # Google never answered, or this run did not ask, make it incomplete: a
    # rejected answer is logged, and asking again soon is unlikely to change it.
    return EXIT_RETRY if unreached or left else EXIT_DONE


def choose(
    centre: Centre, candidates: Sequence[Candidate]
) -> tuple[Candidate, int] | str:
    """Picks the listing that belongs to the centre, or says why none does.

    The nearest candidate is preferred over a better-named one far away, so a
    namesake in another town cannot win over the home at the centre's address.
    """
    if not candidates:
        return "no_listing"
    measured = [
        (candidate, _metres(centre, candidate), _score(centre, candidate))
        for candidate in candidates
    ]
    close = [row for row in measured if row[1] <= MAX_DISTANCE_M]
    candidate, distance, _ = max(
        close or measured, key=lambda row: (row[2], -row[1])
    )
    if not agrees(centre.name, candidate.name):
        return "name"
    if distance > MAX_DISTANCE_M:
        return "far"
    if candidate.photo_count < 1:
        return "no_photo"
    return candidate, distance


def _score(centre: Centre, candidate: Candidate) -> float:
    """How alike the two names are, by the better of the two comparisons."""
    return max(
        spelling_similarity(centre.name, candidate.name),
        word_overlap(centre.name, candidate.name),
    )


def _metres(centre: Centre, candidate: Candidate) -> int:
    """The distance between the centre's point and the listing's, in metres."""
    first, second = (
        math.radians(centre.latitude),
        math.radians(candidate.latitude),
    )
    delta_latitude = second - first
    delta_longitude = math.radians(candidate.longitude - centre.longitude)
    haversine = math.sin(delta_latitude / 2) ** 2 + (
        math.cos(first) * math.cos(second) * math.sin(delta_longitude / 2) ** 2
    )
    return round(2 * EARTH_RADIUS_M * math.asin(math.sqrt(haversine)))


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    sys.exit(main())
