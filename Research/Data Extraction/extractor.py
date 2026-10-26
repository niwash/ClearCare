"""
extractor.py
------------
Extracts structured amenities data from HIQA inspection reports using
GPT-4o-mini and OpenAI's structured outputs.

The pipeline already downloads and stores every HIQA report, so this script
does not download anything. It reads the pipeline's manifest to find the
latest report for each home, opens that PDF from the pipeline's raw store,
and writes one JSON file per home.

    <data-dir>/manifests/inspection-reports.jsonl   which reports exist
    <data-dir>/raw/sha256/<2 hex>/<digest>          the stored PDFs
    <data-dir>/amenities/<centre_id>.json           the output

Usage (from the repository root, so that the root .env is found)
-----
    python "Research/Data Extraction/extractor.py"
    python "Research/Data Extraction/extractor.py" --dry-run
    python "Research/Data Extraction/extractor.py" --centre-id 1 --centre-id 13
    python "Research/Data Extraction/extractor.py" --force

A home is skipped when its output file already exists for the same report.
If HIQA has published a newer report since, the home is extracted again.
"""

import argparse
import json
import logging
import os
from datetime import UTC, datetime
from pathlib import Path

import pdfplumber
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

MODEL = "gpt-4o-mini"
# Stored with every output file. Change it when the prompt, the schema or the
# model changes, so that results from different runs can be told apart.
EXTRACTOR_VERSION = "amenities-v1"

MANIFEST_NAME = "inspection-reports.jsonl"


# ---------------------------------------------------------------------------
# Output schema
# ---------------------------------------------------------------------------
# Pydantic models with OpenAI's structured outputs (beta.chat.completions.parse).
# The API is forced to return JSON that matches this schema, so the response
# never needs to be parsed or repaired by hand.


class Amenities(BaseModel):
    care_types: list[str] = Field(
        default_factory=list,
        description=(
            "Types of care offered. Common values: 'long-term residential', "
            "'dementia care', 'respite care', 'palliative care', "
            "'convalescent care', 'day care'. Include only what the report "
            "explicitly states."
        ),
    )
    room_types: list[str] = Field(
        default_factory=list,
        description=(
            "Room types available. Common values: 'single room', "
            "'shared room', 'en-suite', 'twin room'. Include only what the "
            "report mentions."
        ),
    )
    has_outdoor_space: bool | None = Field(
        default=None,
        description=(
            "True if the report mentions an accessible garden, courtyard, or "
            "outdoor space for residents."
        ),
    )
    activities: list[str] = Field(
        default_factory=list,
        description=(
            "Activities, therapies, or social programmes mentioned. "
            "Examples: 'physiotherapy', 'occupational therapy', 'music "
            "therapy', 'arts and crafts', 'exercise classes', 'reminiscence "
            "therapy'."
        ),
    )
    has_transport: bool | None = Field(
        default=None,
        description=(
            "True if the centre provides transport for residents, such as a "
            "bus or car for outings or appointments. Public transport near "
            "the centre (Luas, DART, local buses) does not count."
        ),
    )
    has_chapel_or_religious_services: bool | None = Field(
        default=None,
        description=(
            "True if a chapel, oratory, or religious services are mentioned."
        ),
    )
    special_units: list[str] = Field(
        default_factory=list,
        description=(
            "Specialist care units or dedicated areas mentioned. Examples: "
            "'secure dementia unit', 'memory care unit', 'palliative care "
            "suite'."
        ),
    )
    dining_notes: str = Field(
        default="",
        description=(
            "Any mentions of dining arrangements, mealtimes, or food-related "
            "amenities. Leave empty if nothing relevant is mentioned."
        ),
    )
    other_notes: str = Field(
        default="",
        description=(
            "Any other notable amenities or facilities not covered by the "
            "fields above."
        ),
    )


class AmenitiesResult(BaseModel):
    amenities: Amenities


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


def stored_pdf(data_dir: Path, sha256: str) -> Path:
    """Returns where the pipeline's raw store keeps a file with this hash."""
    return data_dir / "raw" / "sha256" / sha256[:2] / sha256


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

# The whole report is sent. Reports run from about 19,000 to 49,000 characters
# (up to ~12,000 tokens), well inside GPT-4o-mini's 128k context, and amenity
# detail turns up all over: the provider's description near the start, the
# inspectors' observations, and "Regulation 9: Residents' rights". MAX_CHARS is
# only a safety cap for an unusually long report.
MAX_CHARS = 200_000

SYSTEM_PROMPT = (
    "You are a data extraction assistant specialising in Irish nursing home "
    "inspection reports published by HIQA (Health Information and Quality "
    "Authority). Extract structured information from the report text "
    "provided. Read the whole report: amenity details can appear anywhere, "
    "including the 'About the designated centre' section, the inspectors' "
    "observations of the day, and the 'Regulation 9: Residents' rights' "
    "section. Extract ONLY what is explicitly stated or clearly implied in "
    "the text. Do not invent, guess, or hallucinate details. If information "
    "for a field is not present in the text, leave it as null or empty. "
    "For has_transport, count only transport the centre itself provides for "
    "residents. A note that the centre is near the Luas, DART or local buses "
    "is about location, not a service, so leave has_transport as null."
)

USER_PROMPT_TEMPLATE = """
The following is an inspection report for the nursing home with HIQA centre ID {centre_id} (inspected on {inspection_date}).
Extract the amenities information as instructed.

Report text:
---
{report_text}
---
""".strip()


def extract_text_from_pdf(pdf_path: Path) -> str:
    """Returns all the text in a PDF, pages separated by newlines."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
    return "\n".join(pages)


def call_llm(
    client: OpenAI, centre_id: str, inspection_date: str, report_text: str
) -> Amenities | None:
    """Sends the report to GPT-4o-mini and returns the validated amenities."""
    if len(report_text) > MAX_CHARS:
        log.warning(
            "  Report is %d characters, cutting to %d.",
            len(report_text),
            MAX_CHARS,
        )
    user_message = USER_PROMPT_TEMPLATE.format(
        centre_id=centre_id,
        inspection_date=inspection_date,
        report_text=report_text[:MAX_CHARS],
    )
    try:
        response = client.beta.chat.completions.parse(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            response_format=AmenitiesResult,
            temperature=0,  # no randomness, so a re-run gives the same answer
            # A reply cut off mid-JSON fails to parse, and reading the whole
            # report gives longer lists than a short excerpt does.
            max_tokens=2000,
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
    parsed = response.choices[0].message.parsed
    return parsed.amenities if parsed else None


def already_done(output_path: Path, sha256: str) -> bool:
    """True if the output file was made from this very report."""
    if not output_path.exists():
        return False
    try:
        existing = json.loads(output_path.read_text(encoding="utf-8"))
    except ValueError:
        return False
    return existing.get("sha256") == sha256


def process_centre(
    client: OpenAI,
    centre_id: str,
    report: dict,
    data_dir: Path,
    output_dir: Path,
    force: bool,
) -> bool:
    """Extracts one home's amenities. Returns True on success or if done."""
    output_path = output_dir / f"{centre_id}.json"
    if not force and already_done(output_path, report["sha256"]):
        log.debug("Already done: centre %s", centre_id)
        return True

    log.info("Processing centre %s (%s)", centre_id, report["inspection_date"])
    pdf_path = stored_pdf(data_dir, report["sha256"])
    if not pdf_path.exists():
        log.error("  PDF not in the raw store: %s", pdf_path)
        return False
    try:
        text = extract_text_from_pdf(pdf_path)
    except Exception as error:
        log.error("  PDF text extraction failed: %s", error)
        return False
    if not text.strip():
        log.warning(
            "  No text in %s. It may be a scanned image-only PDF, which "
            "pdfplumber cannot read.",
            pdf_path.name,
        )
        return False

    amenities = call_llm(client, centre_id, report["inspection_date"], text)
    if amenities is None:
        return False

    output = {
        "centre_id": centre_id,
        "inspection_date": report["inspection_date"],
        "file_name": report["file_name"],
        "hiqa_url": report["url"],
        # The hash names the exact PDF the amenities were read from, which is
        # how the database refers to a stored report.
        "sha256": report["sha256"],
        "model": MODEL,
        "extractor_version": EXTRACTOR_VERSION,
        "extracted_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "amenities": amenities.model_dump(),
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return True


def centre_ids_from_file(path: Path) -> list[str]:
    """Reads centre IDs from a JSON list of IDs or of objects with centre_id."""
    items = json.loads(path.read_text(encoding="utf-8"))
    return [
        str(item["centre_id"] if isinstance(item, dict) else item)
        for item in items
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
        help="only the centres in this JSON file (a list of IDs or of objects with a centre_id)",
    )
    parser.add_argument(
        "--limit", type=int, help="stop after this many homes"
    )
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
    if not manifest_path.exists():
        log.error(
            "No manifest at %s. Run the pipeline's reports download first, "
            "or pass --data-dir.",
            manifest_path,
        )
        return
    output_dir = args.output_dir or args.data_dir / "amenities"

    latest = latest_reports(manifest_path)
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
            done = already_done(output_dir / f"{centre_id}.json", report["sha256"])
            print(
                f"{centre_id}\t{report['inspection_date']}\t{report['file_name']}"
                f"\t{'done' if done else 'to do'}"
            )
        return

    client = OpenAI()  # reads OPENAI_API_KEY from the environment or .env
    failed = []
    for centre_id in centres:
        ok = process_centre(
            client, centre_id, latest[centre_id], args.data_dir, output_dir,
            args.force,
        )
        if not ok:
            failed.append(centre_id)

    log.info("Done. %d succeeded, %d failed.", len(centres) - len(failed), len(failed))
    if failed:
        log.warning("Failed centre IDs: %s", failed)


if __name__ == "__main__":
    main()
