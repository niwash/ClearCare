"""Extract and load missing amenities after report ingestion."""

import argparse
import logging
import os
import sys
from collections.abc import Callable, Mapping, Sequence
from functools import partial
from pathlib import Path

import anthropic
import psycopg

from clearcare_pipeline.amenities.catalogue import reports
from clearcare_pipeline.amenities.extractor import (
    EXTRACTOR_VERSION,
    already_done,
    call_llm,
    output_file,
    process_centre,
)
from clearcare_pipeline.amenities_v2 import ExtractionFile
from clearcare_pipeline.exit_codes import EXIT_DONE, EXIT_FAILED, EXIT_RETRY
from clearcare_pipeline.ingest_reports.database import Connection
from clearcare_pipeline.load_amenities import load
from clearcare_pipeline.object_store import (
    ObjectStore,
    ObjectStoreError,
    S3ObjectStore,
)
from clearcare_pipeline.s3_settings import (
    S3Settings,
    SettingsError,
    make_s3_client,
)

logger = logging.getLogger(__name__)
ARCHIVE_PREFIX = f"amenities/scheduled/{EXTRACTOR_VERSION}/"
MAX_FAILURES_IN_A_ROW = 3
ExtractOne = Callable[[str, dict[str, str], Path], bool]


def run(
    connection: Connection,
    data_dir: Path,
    extract: ExtractOne,
    *,
    limit: int = 20,
    store: ObjectStore | None = None,
) -> int:
    """Archive each valid result before loading it; retry gaps next run."""
    pending = reports(connection, pending_only=True)
    # List before any paid calls. A storage outage must not waste extraction.
    archived: frozenset[str] = (
        store.existing_keys(ARCHIVE_PREFIX) if store else frozenset()
    )
    output_dir = data_dir / "scheduled-amenities"
    done = failed = consecutive = 0
    selected = list(pending.items())[:limit]
    for centre, source in selected:
        path = output_file(output_dir, centre, source["sha256"])
        key = f"{ARCHIVE_PREFIX}{centre}/{source['sha256']}.json"
        if store and key in archived:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(store.get(key))
        elif not extract(centre, source, output_dir):
            logger.warning("amenities extraction failed for centre %s", centre)
            failed += 1
            consecutive += 1
            if consecutive >= MAX_FAILURES_IN_A_ROW:
                logger.warning("stopping after %d consecutive failures", failed)
                break
            continue
        # Invalid cached data fails visibly instead of being overwritten or
        # attached to a different source. The loader checks raw PDF identity.
        record = ExtractionFile.model_validate_json(path.read_bytes())
        if record.centre_id != centre or record.sha256 != source["sha256"]:
            raise ValueError(
                f"Cached amenities source mismatch: centre {centre}"
            )
        if store and key not in archived:
            store.put(key, path.read_bytes())
        summary = load(connection, [record], data_dir=data_dir)
        if summary.unmatched:
            raise ValueError(f"No stored amenities source: centre {centre}")
        done += 1
        consecutive = 0
    left = len(pending) - done - failed
    logger.info(
        "amenities: %d pending, %d loaded, %d failed, %d deferred",
        len(pending),
        done,
        failed,
        left,
    )
    return EXIT_RETRY if failed or left else EXIT_DONE


def main(
    argv: Sequence[str] | None = None,
    env: Mapping[str, str] | None = None,
) -> int:
    """Run only when CLEARCARE_AMENITIES=on; --dry-run makes no model call."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    env = os.environ if env is None else env
    enabled = env.get("CLEARCARE_AMENITIES", "off")
    if args.limit <= 0 or enabled not in {"on", "off"}:
        logger.error("Use a positive limit and CLEARCARE_AMENITIES=on or off")
        return EXIT_FAILED
    if enabled == "off" and not args.dry_run:
        logger.info("CLEARCARE_AMENITIES is off; amenities stage skipped")
        return EXIT_DONE
    client: anthropic.Anthropic | None = None

    def extract(centre: str, source: dict[str, str], output: Path) -> bool:
        nonlocal client
        if already_done(
            output_file(output, centre, source["sha256"]), source["sha256"]
        ):
            return True
        if client is None:
            key = env.get("ANTHROPIC_API_KEY")
            if not key:
                raise ValueError("ANTHROPIC_API_KEY is required for extraction")
            client = anthropic.Anthropic(
                api_key=key,
                timeout=60.0,
                max_retries=2,
            )
        return (
            process_centre(
                client,
                "anthropic",
                centre,
                source,
                args.data_dir,
                output,
                False,
                extract=partial(call_llm, raise_on_auth_error=True),
            )
            is not None
        )

    try:
        with psycopg.connect(autocommit=True) as connection:
            if args.dry_run:
                for centre, source in reports(
                    connection,
                    pending_only=True,
                ).items():
                    logger.info(
                        "pending centre %s, date %s, hash %s",
                        centre,
                        source["inspection_date"],
                        source["sha256"],
                    )
                return EXIT_DONE
            store = None
            if any(v for k, v in env.items() if k.startswith("CLEARCARE_S3_")):
                settings = S3Settings.from_env(env)
                store = S3ObjectStore(make_s3_client(settings), settings.bucket)
            return run(
                connection,
                args.data_dir,
                extract,
                limit=args.limit,
                store=store,
            )
    except (
        psycopg.Error,
        OSError,
        ValueError,
        SettingsError,
        ObjectStoreError,
    ) as error:
        logger.error("amenities stage failed: %s", error)
        return EXIT_FAILED


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    sys.exit(main())
