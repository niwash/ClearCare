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
import hashlib
import json
import logging
import os
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, cast
from urllib.parse import unquote, urlparse

from amenities_v2 import Amenities, AmenitiesResult, EvidenceCheck, ExtractionFile
from dotenv import load_dotenv
from pydantic import ValidationError

if TYPE_CHECKING:
    from anthropic import Anthropic
    from openai import OpenAI

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# The model asked for on each provider. The output file records the model the
# API reports instead.
MODELS = {"anthropic": "claude-haiku-5-5", "openai": "gpt-4o-mini"}
# Stored with every output file. Change it when the prompt or the schema
# changes; the model is recorded in every output file.
EXTRACTOR_VERSION = "amenities-v2"

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

    query = """
        SELECT DISTINCT ON (r.centre_id)
            r.centre_id, r.inspection_date, s.sha256, s.url
        FROM clearcare.inspection_report r
        JOIN clearcare.source_file s USING (source_file_id)
        ORDER BY r.centre_id, r.inspection_date DESC NULLS LAST, r.id
    """
    reports: dict[str, dict] = {}
    with psycopg.connect() as connection:
        for centre, date, digest, url in connection.execute(query):
            if date is None:
                log.warning("No inspection date for centre %s; skipping", centre)
                continue
            reports[centre] = {
                "inspection_date": date.isoformat(),
                "sha256": digest,
                "url": url,
                "file_name": unquote(Path(urlparse(url).path).name),
            }
    return reports


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
MAX_CHARS = 200_000

SYSTEM_PROMPT = (
    Path(__file__).with_name("amenities-v2-prompt.txt").read_text(encoding="utf-8")
)

USER_PROMPT_TEMPLATE = """
HIQA inspection report for centre ID {centre_id}.
Inspection date: {inspection_date}.
Extract the amenities information as instructed.

Report text:
---
{report_text}
---
""".strip()


def extract_text_from_pdf(pdf_path: Path) -> tuple[str, list[str]]:
    """Returns the marked-up report text for the model, and each page's text.

    Every PDF page keeps its position, including blank pages.
    """
    import pdfplumber

    with pdfplumber.open(pdf_path) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    text = "\n".join(
        f"[PDF PAGE {number}]\n{page}" for number, page in enumerate(pages, 1)
    )
    return text, pages


def call_llm(
    client: Anthropic | OpenAI,
    provider: str,
    centre_id: str,
    inspection_date: str,
    report_text: str,
) -> tuple[Amenities, str] | None:
    """Sends the report to the provider's model and returns the amenities."""
    if len(report_text) > MAX_CHARS:
        log.error("Report exceeds the full-report safety limit; not truncating")
        return None
    user_message = USER_PROMPT_TEMPLATE.format(
        centre_id=centre_id,
        inspection_date=inspection_date,
        report_text=report_text,
    )
    if provider == "anthropic":
        reply = call_anthropic(cast("Anthropic", client), user_message)
    else:
        reply = call_openai(cast("OpenAI", client), user_message)
    if reply is None:
        return None
    result, model = reply
    if not model.strip():
        log.error("Invalid extraction: the response has no model identifier")
        return None
    return result.amenities, model


def call_anthropic(
    client: Anthropic, user_message: str
) -> tuple[AmenitiesResult, str] | None:
    """Asks Claude for the amenities; None if the call or its output failed."""
    import anthropic

    def ask() -> anthropic.types.ParsedMessage[AmenitiesResult]:
        # No sampling parameters: current Claude models reject them.
        return client.messages.parse(
            model=MODELS["anthropic"],
            # Quote-bearing output and the model's thinking share this budget.
            max_tokens=16000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
            output_format=AmenitiesResult,
        )

    try:
        try:
            response = ask()
        except ValidationError as error:
            # A reply outside the contract, such as an item listed twice or
            # an empty quote, is the model's slip, not the request's, so a
            # second reply can be valid.
            log.warning("  Invalid extraction, asking once more: %s", error)
            response = ask()
    except anthropic.APIStatusError as error:
        log.error("  LLM call failed with status %d: %s", error.status_code, error)
        return None
    except anthropic.APIConnectionError as error:
        log.error("  Could not reach the API: %s", error)
        return None
    except ValidationError as error:
        # parse validates the reply as it reads it, so output cut off mid-JSON
        # or outside the contract fails here, before stop_reason can be read.
        log.error("Invalid extraction: %s", error)
        return None
    log.info(
        "  tokens: %d in, %d out",
        response.usage.input_tokens,
        response.usage.output_tokens,
    )
    if response.stop_reason != "end_turn" or response.parsed_output is None:
        log.error("Incomplete or refused extraction: %s", response.stop_reason)
        return None
    return response.parsed_output, response.model or ""


def call_openai(
    client: OpenAI, user_message: str
) -> tuple[AmenitiesResult, str] | None:
    """Asks GPT-4o-mini for the amenities; None if the call or output failed."""
    try:
        response = client.beta.chat.completions.parse(
            model=MODELS["openai"],
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            response_format=AmenitiesResult,
            temperature=0,  # Keep sampling settings fixed between runs.
            # Quote-bearing output needs more room; truncated output remains a failure.
            max_tokens=16000,
        )
    except Exception as error:
        log.error("  LLM call failed: %s", error)
        return None
    if response.usage:
        log.info(
            "  tokens: %d in, %d out",
            response.usage.prompt_tokens,
            response.usage.completion_tokens,
        )
    try:
        choice = response.choices[0]
        if (
            choice.finish_reason != "stop"
            or choice.message.refusal
            or not choice.message.parsed
        ):
            raise ValueError("Incomplete or refused extraction")
        return choice.message.parsed, response.model or ""
    except (ValueError, IndexError, AttributeError) as error:
        log.error("Invalid extraction: %s", error)
        return None


def already_done(output_path: Path, sha256: str) -> bool:
    """Only a valid file for this exact source and extractor version is cached."""
    try:
        existing = ExtractionFile.model_validate_json(output_path.read_bytes())
        return (
            existing.sha256 == sha256 and existing.centre_id == output_path.parent.name
        )
    except (OSError, ValueError):
        return False


def output_file(output_dir: Path, centre_id: str, sha256: str) -> Path:
    """Keep v1 files and each distinct v2 source report intact."""
    return output_dir / EXTRACTOR_VERSION / centre_id / f"{sha256}.json"


# Items kept and dropped, evidence corrected and dropped.
EVIDENCE_LOG = "%s: items %d kept, %d dropped; evidence %d corrected, %d dropped"


def process_centre(
    client: Anthropic | OpenAI,
    provider: str,
    centre_id: str,
    report: dict,
    data_dir: Path,
    output_dir: Path,
    force: bool,
) -> EvidenceCheck | None:
    """Extracts one home's amenities.

    Returns what the evidence check changed, an empty check if the home is
    already done, or None if it failed.
    """
    try:
        # Validate provenance before using IDs or hashes in filesystem paths.
        metadata = ExtractionFile.model_validate(
            {
                "centre_id": centre_id,
                "inspection_date": report["inspection_date"],
                "file_name": report["file_name"],
                "hiqa_url": report["url"],
                "sha256": report["sha256"],
                "model": MODELS[provider],
                "extractor_version": EXTRACTOR_VERSION,
                "extracted_at": datetime.now(UTC),
                "amenities": {
                    "care_types": [],
                    "room_types": [],
                    "activities": [],
                    "facilities": [],
                },
            }
        )
    except (KeyError, ValueError) as error:
        log.error("Invalid source metadata: %s", error)
        return None
    output_path = output_file(output_dir, centre_id, metadata.sha256)
    if not force and already_done(output_path, report["sha256"]):
        log.debug("Already done: centre %s", centre_id)
        return EvidenceCheck()

    log.info("Processing centre %s (%s)", centre_id, report["inspection_date"])
    pdf_path = stored_pdf(data_dir, report["sha256"])
    if not pdf_path.exists():
        log.error("  PDF not in the raw store: %s", pdf_path)
        return None
    try:
        if hashlib.sha256(pdf_path.read_bytes()).hexdigest() != metadata.sha256:
            raise ValueError("Stored PDF does not match its source hash")
        text, pages = extract_text_from_pdf(pdf_path)
    except Exception as error:
        log.error("  PDF text extraction failed: %s", error)
        return None
    if not any(
        line.strip() and not line.startswith("[PDF PAGE ") for line in text.splitlines()
    ):
        log.warning(
            "  No text in %s. It may be a scanned image-only PDF, which "
            "pdfplumber cannot read.",
            pdf_path.name,
        )
        return None

    extracted = call_llm(client, provider, centre_id, report["inspection_date"], text)
    if extracted is None:
        return None

    amenities, actual_model = extracted
    # The check comes first: a quote cited past the last page is searched
    # for and moved, where the page check would fail the home.
    amenities, check = amenities.verify_evidence(pages)
    amenities.validate_pages(len(pages))
    log.info(
        EVIDENCE_LOG,
        "  evidence check",
        check.items_kept,
        check.items_dropped,
        check.evidence_corrected,
        check.evidence_dropped,
    )
    for _, item, quote in check.dropped:
        log.warning("  dropped quote: %s: %s", item, quote)
    output = ExtractionFile.model_validate(
        metadata.model_dump()
        | {
            "amenities": amenities,
            "model": actual_model,
            "extracted_at": datetime.now(UTC),
        }
    )
    # Atomic replacement means failed writes cannot leave a partial successful file.
    temporary = None
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=output_path.parent,
            suffix=".tmp",
            delete=False,
        ) as handle:
            temporary = Path(handle.name)
            handle.write(output.model_dump_json(indent=2))
        temporary.replace(output_path)
    except OSError as error:
        log.error("Could not write extraction: %s", error)
        return None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return check


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
