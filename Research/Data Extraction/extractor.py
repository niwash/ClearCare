"""
extractor.py
------------
Extracts structured amenities data from HIQA inspection reports with a
model's structured outputs: Claude Haiku 5.5 by default, or GPT-4o-mini with
--provider openai.

The pipeline already downloads and stores every HIQA report, so this script
does not download anything. It reads parsed database reports to find the
latest report for each home, opens that PDF from the pipeline's raw store,
and writes one JSON file per home.

    PostgreSQL inspection_report and source_file  report catalogue
    <data-dir>/raw/sha256/<2 hex>/<digest>          the stored PDFs
    <data-dir>/amenities/amenities-v2/<centre_id>/<sha256>.json           the output

Usage (from the repository root, so that the root .env is found)
-----
    python "Research/Data Extraction/extractor.py"
    python "Research/Data Extraction/extractor.py" --dry-run
    python "Research/Data Extraction/extractor.py" --centre-id 1 --centre-id 13
    python "Research/Data Extraction/extractor.py" --force
    python "Research/Data Extraction/extractor.py" --provider openai

A home is skipped only for a valid output from the same report and version.
If HIQA has published a newer report since, the home is extracted again.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import TYPE_CHECKING

from amenities_v2 import EvidenceCheck
from clearcare_pipeline.amenities import extractor as shared
from dotenv import load_dotenv

if TYPE_CHECKING:
    from anthropic import Anthropic
    from openai import OpenAI

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
log = shared.log

# The model asked for on each provider. The output file records the model the
# API reports instead.
MODELS = shared.MODELS
# Stored with every output file. Change it when the prompt or the schema
# changes; the model is recorded in every output file.
EXTRACTOR_VERSION = shared.EXTRACTOR_VERSION

MANIFEST_NAME = "inspection-reports.jsonl"


# ---------------------------------------------------------------------------
# Finding the latest report for each home
# ---------------------------------------------------------------------------


def latest_reports(manifest_path: Path) -> dict[str, dict]:
    """Returns the latest stored report of each centre, by centre_id.

    The manifest gets a line per centre every time the pipeline crawls, so a
    centre appears many times. Later lines win. Within a line, the report with
    the latest inspection date that has a stored PDF is used.
    """
    latest: dict[str, dict] = {}
    with manifest_path.open(encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            record = json.loads(line)
            stored = [
                report
                for report in record.get("reports", [])
                if report.get("sha256") and not report.get("error")
            ]
            if stored:
                latest[str(record["centre_id"])] = max(
                    stored, key=lambda report: report["inspection_date"]
                )
    return latest


def database_reports() -> dict[str, dict]:
    """Select the latest parsed report per centre using the API's ordering."""
    import psycopg
    from clearcare_pipeline.amenities.catalogue import reports

    with psycopg.connect() as connection:
        return reports(connection)


def stored_pdf(data_dir: Path, sha256: str) -> Path:
    """Returns where the pipeline's raw store keeps a file with this hash."""
    return data_dir / "raw" / "sha256" / sha256[:2] / sha256


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

# The whole report is sent. Reports run from about 19,000 to 49,000 characters
# (up to ~12,000 tokens), well inside either model's context, and amenity
# detail turns up all over: the provider's description near the start, the
# inspectors' observations, and "Regulation 9: Residents' rights". MAX_CHARS is
# only a safety cap for an unusually long report.
MAX_CHARS = shared.MAX_CHARS
SYSTEM_PROMPT = shared.SYSTEM_PROMPT
USER_PROMPT_TEMPLATE = shared.USER_PROMPT_TEMPLATE
extract_text_from_pdf = shared.extract_text_from_pdf
call_llm = shared.call_llm
already_done = shared.already_done
output_file = shared.output_file
EVIDENCE_LOG = shared.EVIDENCE_LOG


def process_centre(
    client, provider, centre_id, report, data_dir, output_dir, force
) -> EvidenceCheck | None:
    """Use the packaged extractor while retaining the standalone CLI."""
    return shared.process_centre(
        client,
        provider,
        centre_id,
        report,
        data_dir,
        output_dir,
        force,
        extract=call_llm,
        read_pdf=extract_text_from_pdf,
    )


def centre_ids_from_file(path: Path) -> list[str]:
    """Reads centre IDs from a JSON list of IDs or of objects with centre_id."""
    items = json.loads(path.read_text(encoding="utf-8"))
    return [
        str(item["centre_id"] if isinstance(item, dict) else item) for item in items
    ]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract amenities from the latest HIQA report of each home."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(os.environ.get("CLEARCARE_DATA_DIR", "data")),
        help="the pipeline's data directory (default: CLEARCARE_DATA_DIR or ./data)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="where to write the JSON files (default: <data-dir>/amenities)",
    )
    parser.add_argument(
        "--centre-id",
        action="append",
        default=[],
        help="only this centre; can be given more than once",
    )
    parser.add_argument(
        "--centres-file",
        type=Path,
        help="only centres in this JSON file (IDs or objects with centre_id)",
    )
    parser.add_argument(
        "--provider",
        choices=list(MODELS),
        default="anthropic",
        help="whose model reads the reports (default: anthropic)",
    )
    parser.add_argument(
        "--report-source",
        choices=["database", "manifest"],
        default="database",
        help="report catalogue (default: database via libpq)",
    )
    parser.add_argument("--limit", type=int, help="stop after this many homes")
    parser.add_argument(
        "--force",
        action="store_true",
        help="extract again even if the output file is up to date",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="list the report that would be used for each home, and stop",
    )
    args = parser.parse_args()

    manifest_path = args.data_dir / "manifests" / MANIFEST_NAME
    if args.report_source == "manifest" and not manifest_path.exists():
        log.error(
            "No manifest at %s. Run the pipeline's reports download first, "
            "or pass --data-dir.",
            manifest_path,
        )
        sys.exit(1)
    output_dir = args.output_dir or args.data_dir / "amenities"

    latest = (
        database_reports()
        if args.report_source == "database"
        else latest_reports(manifest_path)
    )
    wanted = list(args.centre_id)
    if args.centres_file:
        wanted += centre_ids_from_file(args.centres_file)
    if wanted:
        unknown = sorted(set(wanted) - set(latest))
        if unknown:
            log.warning("No stored report for centre IDs: %s", unknown)
        latest = {key: latest[key] for key in wanted if key in latest}
    centres = sorted(latest, key=int)
    if args.limit:
        centres = centres[: args.limit]
    log.info("%d homes to consider.", len(centres))

    if args.dry_run:
        for centre_id in centres:
            report = latest[centre_id]
            done = already_done(
                output_file(output_dir, centre_id, report["sha256"]), report["sha256"]
            )
            print(
                f"{centre_id}\t{report['inspection_date']}\t{report['file_name']}"
                f"\t{'done' if done else 'to do'}"
            )
        return

    # Each client reads its key, ANTHROPIC_API_KEY or OPENAI_API_KEY, from the
    # environment or .env.
    client: Anthropic | OpenAI
    if args.provider == "anthropic":
        from anthropic import Anthropic

        client = Anthropic()
    else:
        from openai import OpenAI

        client = OpenAI()
    failed = []
    items_kept = items_dropped = evidence_corrected = evidence_dropped = 0
    for centre_id in centres:
        check = process_centre(
            client,
            args.provider,
            centre_id,
            latest[centre_id],
            args.data_dir,
            output_dir,
            args.force,
        )
        if check is None:
            failed.append(centre_id)
            continue
        items_kept += check.items_kept
        items_dropped += check.items_dropped
        evidence_corrected += check.evidence_corrected
        evidence_dropped += check.evidence_dropped

    log.info(
        EVIDENCE_LOG,
        "Evidence check, all homes",
        items_kept,
        items_dropped,
        evidence_corrected,
        evidence_dropped,
    )
    log.info("Done. %d succeeded, %d failed.", len(centres) - len(failed), len(failed))
    if failed:
        log.warning("Failed centre IDs: %s", failed)
        sys.exit(1)


if __name__ == "__main__":
    main()
