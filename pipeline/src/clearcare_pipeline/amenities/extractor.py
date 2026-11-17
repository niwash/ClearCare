"""Shared whole-report extraction used by the CLI and scheduler."""

from __future__ import annotations

import hashlib
import logging
import tempfile
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import anthropic
from pydantic import ValidationError

from clearcare_pipeline.amenities_v2 import (
    Amenities,
    AmenitiesResult,
    EvidenceCheck,
    ExtractionFile,
)

log = logging.getLogger(__name__)
MODELS = {"anthropic": "claude-haiku-5-5", "openai": "gpt-4o-mini"}
EXTRACTOR_VERSION = "amenities-v2"


MAX_CHARS = 200_000

SYSTEM_PROMPT = (
    Path(__file__).with_name("prompt.txt").read_text(encoding="utf-8")
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


def stored_pdf(data_dir: Path, sha256: str) -> Path:
    """Locate the exact source in the pipeline's content-addressed store."""
    return data_dir / "raw" / "sha256" / sha256[:2] / sha256


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
    client: Any,
    provider: str,
    centre_id: str,
    inspection_date: str,
    report_text: str,
    *,
    raise_on_auth_error: bool = False,
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
        reply = call_anthropic(
            client, user_message, raise_on_auth_error=raise_on_auth_error
        )
    else:
        reply = call_openai(client, user_message)
    if reply is None:
        return None
    result, model = reply
    if not model.strip():
        log.error("Invalid extraction: the response has no model identifier")
        return None
    return result.amenities, model


def call_anthropic(
    client: Any, user_message: str, *, raise_on_auth_error: bool = False
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
        if raise_on_auth_error and error.status_code in {401, 403}:
            raise ValueError(
                "Anthropic authentication or permissions refused; check the key"
            ) from error
        log.error(
            "  LLM call failed with status %d: %s", error.status_code, error
        )
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
    client: Any, user_message: str
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
            # Allow quote-bearing output. Truncation remains a failure.
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
    """Skip only a valid file for the same source and version."""
    try:
        existing = ExtractionFile.model_validate_json(output_path.read_bytes())
        return (
            existing.sha256 == sha256
            and existing.centre_id == output_path.parent.name
        )
    except (OSError, ValueError):
        return False


def output_file(output_dir: Path, centre_id: str, sha256: str) -> Path:
    """Keep v1 files and each distinct v2 source report intact."""
    return output_dir / EXTRACTOR_VERSION / centre_id / f"{sha256}.json"


# Items kept and dropped, evidence corrected and dropped.
EVIDENCE_LOG = (
    "%s: items %d kept, %d dropped; evidence %d corrected, %d dropped"
)


def process_centre(
    client: Any,
    provider: str,
    centre_id: str,
    report: Mapping[str, str],
    data_dir: Path,
    output_dir: Path,
    force: bool,
    *,
    extract: Callable[..., tuple[Amenities, str] | None] | None = None,
    read_pdf: Callable[[Path], tuple[str, list[str]]] | None = None,
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
        text, pages = (read_pdf or extract_text_from_pdf)(pdf_path)
    except Exception as error:
        log.error("  PDF text extraction failed: %s", error)
        return None
    if not any(
        line.strip() and not line.startswith("[PDF PAGE ")
        for line in text.splitlines()
    ):
        log.warning(
            "  No text in %s. It may be a scanned image-only PDF, which "
            "pdfplumber cannot read.",
            pdf_path.name,
        )
        return None

    extracted = (extract or call_llm)(
        client, provider, centre_id, report["inspection_date"], text
    )
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
    # Failed writes must not leave a partial successful file.
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
