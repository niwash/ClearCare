"""Ask a model what each finding's next report says about it.

python -m clearcare_pipeline.outcome_pilot --pairs pairs.csv --out DIR

For every Substantially compliant or Not compliant judgment in each pair's
finding report, the model reads the finding, the provider's response and the
pair's next report, and answers the two questions of the CCARE-113 label
sheet 2: the re-assessment and the reported outcome. Writes DIR/predictions.csv
with sheet 2's keys, and DIR/raw/ with every response as the API returned it.
"""

import argparse
import csv
import hashlib
import json
import logging
import sys
import tomllib
from bisect import bisect_right
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Literal

import anthropic
import psycopg
from anthropic.types import Message
from pydantic import BaseModel, ConfigDict, ValidationError

from clearcare_pipeline.ingest_reports.database import Connection
from clearcare_pipeline.parser.text import EXTRACTOR_VERSION, ReportText

logger = logging.getLogger(__name__)

PROMPT = tomllib.loads(
    (Path(__file__).parent / "outcome_pilot_prompt.toml").read_text()
)
# Pinned, with the prompt version, so that a run can be repeated: these models
# take no temperature. Thinking is always on and effort sets its depth.
MODEL = "claude-haiku-5-5"
EFFORT = "high"
MAX_TOKENS = 16000
# US dollars per million input and output tokens, checked on 18 Oct 2026, up
# to and past LONG_PROMPT input tokens. Output tokens include thinking.
PRICES = {
    "claude-haiku-5-5": ((0.10, 0.50), (0.50, 2.50)),
    "claude-opus-5-5": ((4.0, 20.0), (4.0, 20.0)),
}
LONG_PROMPT = 100_000


class Answer(BaseModel):
    """The model's answer for one finding, in sheet 2's values."""

    model_config = ConfigDict(extra="forbid", strict=True)

    re_assessment: Literal[
        "not re-assessed", "improved", "unchanged", "worsened"
    ]
    next_judgment: (
        Literal["Compliant", "Substantially compliant", "Not compliant"] | None
    )
    reported_outcome: Literal[
        "done", "in progress", "not done", "unclear", "no statement found"
    ]
    evidence_quote: str | None
    evidence_page: int | None
    confidence: Literal["low", "medium", "high"]


@dataclass(frozen=True)
class Finding:
    """One row of sheet 2, with what the prompt needs about its reports."""

    pair_id: str
    finding_report_id: int
    regulation: str
    judgment: str
    next_report_id: int
    title: str
    finding_date: str
    next_date: str


# Sheet 2's keys, then the answer, then how it was produced.
COLUMNS = (
    "pair_id",
    "finding_report_id",
    "regulation",
    "judgment",
    "next_report_id",
    *Answer.model_fields,
    "error",
    "model",
    "prompt_version",
    "extractor_version",
    "stop_reason",
    "input_tokens",
    "output_tokens",
    "cost_usd",
)


@dataclass(frozen=True)
class Prompt:
    """The user message, and the next report's text to check quotes against."""

    user: str
    next_report: tuple[ReportText, ...]


def read_pairs(path: Path) -> list[dict[str, str]]:
    """Reads the pairs sheet, failing on a missing column or report ID."""
    with path.open(newline="") as file:
        rows = list(csv.DictReader(file))
    needed = ("pair_id", "finding_report_id", "next_report_id")
    for number, row in enumerate(rows, start=2):
        if any(not (row.get(column) or "").strip() for column in needed):
            raise ValueError(f"{path} line {number}: needs {', '.join(needed)}")
        if not (
            row["finding_report_id"].isdigit()
            and row["next_report_id"].isdigit()
        ):
            raise ValueError(f"{path} line {number}: report IDs are integers")
    return rows


def findings(
    connection: Connection, pairs: Sequence[dict[str, str]]
) -> list[Finding]:
    """Lists each pair's findings in ascending regulation number, as sheet 2."""
    rows: list[Finding] = []
    for pair in pairs:
        judged = connection.execute(
            "SELECT g.regulation, g.title, g.judgment,"
            " f.inspection_date, n.inspection_date"
            " FROM clearcare.inspection_regulation g"
            " JOIN clearcare.inspection_report f ON f.id = g.report_id"
            " JOIN clearcare.inspection_report n ON n.id = %s"
            " WHERE g.report_id = %s AND lower(g.judgment)"
            " IN ('substantially compliant', 'not compliant')"
            " ORDER BY substring(g.regulation FROM '\\d+')::int, g.id",
            (pair["next_report_id"], pair["finding_report_id"]),
        ).fetchall()
        for regulation, title, judgment, finding_date, next_date in judged:
            rows.append(
                Finding(
                    pair["pair_id"],
                    int(pair["finding_report_id"]),
                    regulation,
                    judgment,
                    int(pair["next_report_id"]),
                    title,
                    str(finding_date),
                    str(next_date),
                )
            )
    return rows


def _report_text(connection: Connection, report_id: int) -> list[ReportText]:
    # Ingest writes a report's text in reading order (parser/text.csv), so id
    # order is reading order: the intro, each section's summary and its
    # narratives, then the responses.
    return [
        ReportText(kind, regulation, first, last, text, tuple(offsets))
        for kind, regulation, first, last, text, offsets in connection.execute(
            "SELECT kind, regulation, first_page, last_page, text, page_offsets"
            " FROM clearcare.inspection_report_text"
            " WHERE report_id = %s AND extractor_version = %s ORDER BY id",
            (report_id, EXTRACTOR_VERSION),
        ).fetchall()
    ]


def _with_page_markers(part: ReportText) -> str:
    starts = [0, *part.page_offsets]
    ends = [*part.page_offsets, len(part.text)]
    return "\n".join(
        f"[page {part.first_page + index}]\n{part.text[start:end].strip()}"
        for index, (start, end) in enumerate(zip(starts, ends, strict=True))
    )


def build_prompt(connection: Connection, finding: Finding) -> Prompt:
    """Puts the finding, its response and the next report in one prompt."""
    earlier = {
        part.kind: part.text
        for part in _report_text(connection, finding.finding_report_id)
        if part.regulation == finding.regulation
    }
    later = _report_text(connection, finding.next_report_id)
    if not later:
        raise ValueError(
            f"report {finding.next_report_id} has no text"
            f" at {EXTRACTOR_VERSION}"
        )
    next_report = "\n\n".join(
        "--- "
        + PROMPT["headings"][part.kind].format(regulation=part.regulation)
        + " ---\n"
        + _with_page_markers(part)
        for part in later
    )
    user = PROMPT["user"].format(
        finding_date=finding.finding_date,
        regulation=finding.regulation,
        title=finding.title,
        judgment=finding.judgment,
        narrative=earlier.get("narrative", PROMPT["missing"]),
        response=earlier.get("response", PROMPT["missing"]),
        next_date=finding.next_date,
        next_report=next_report,
    )
    return Prompt(user.strip(), tuple(later))


_PLAIN_MARKS = str.maketrans(
    {
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2013": "-",
        "\u2014": "-",
    }
)


def _plain(text: str) -> tuple[str, list[int]]:
    """Text as _PLAIN_MARKS and single spaces make it, with source offsets."""
    characters: list[str] = []
    offsets: list[int] = []
    for offset, character in enumerate(text.translate(_PLAIN_MARKS)):
        if character.isspace():
            if not characters or characters[-1] == " ":
                continue
            character = " "
        characters.append(character)
        offsets.append(offset)
    return "".join(characters), offsets


def _quote_pages(quote: str, next_report: Sequence[ReportText]) -> list[int]:
    """The pages on which the quote starts, wherever it appears."""
    wanted = _plain(quote)[0].strip()
    pages: list[int] = []
    for part in next_report:
        text, offsets = _plain(part.text)
        start = text.find(wanted)
        while start != -1:
            pages.append(
                part.first_page
                + bisect_right(part.page_offsets, offsets[start])
            )
            start = text.find(wanted, start + 1)
    return pages


def read_answer(
    response: Message, next_report: Sequence[ReportText]
) -> tuple[Answer | None, str]:
    """Returns the answer and why it is invalid, or "" when it is valid.

    A quote counts as verbatim if it appears in one part of the next report
    with only its whitespace, curly quotes or en and em dashes changed: the
    stored text keeps the PDF's line breaks and typography, which a copied
    passage need not. Its page must be where it starts, by the stored page
    offsets.
    """
    if response.stop_reason != "end_turn":
        return None, f"stop_reason: {response.stop_reason}"
    text = "".join(
        block.text for block in response.content if block.type == "text"
    )
    try:
        answer = Answer.model_validate_json(text)
    except ValidationError as error:
        return None, "schema: " + "; ".join(
            f"{'.'.join(map(str, detail['loc'])) or 'answer'} {detail['msg']}"
            for detail in error.errors()
        )
    not_re_assessed = answer.re_assessment == "not re-assessed"
    if not_re_assessed and answer.next_judgment is not None:
        return answer, "next_judgment: given although not re-assessed"
    if not not_re_assessed and answer.next_judgment is None:
        return answer, "next_judgment: missing although re-assessed"
    quote, page = answer.evidence_quote, answer.evidence_page
    if quote is not None and not quote.strip():
        return answer, "quote: blank"
    if (quote is None) != (page is None):
        return answer, "page: a quote needs its page, and a page its quote"
    if quote is not None:
        starts = _quote_pages(quote, next_report)
        if not starts:
            return answer, "quote: not found in the next report"
        if page not in starts:
            return (
                answer,
                f"page: the quote starts on page {starts[0]}, not {page}",
            )
    return answer, ""


def predict(
    client: anthropic.Anthropic, finding: Finding, prompt: Prompt
) -> tuple[dict[str, object], dict[str, Any]]:
    """Asks once and returns the predictions row and the raw record."""
    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=PROMPT["system"].strip(),
        messages=[{"role": "user", "content": prompt.user}],
        output_config={
            "effort": EFFORT,
            "format": {
                "type": "json_schema",
                "schema": anthropic.transform_schema(Answer),
            },
        },
    )
    answer, error = read_answer(response, prompt.next_report)
    usage = response.usage
    # The whole request is priced higher past LONG_PROMPT; the text is never
    # cut to stay under it.
    long_prompt = usage.input_tokens > LONG_PROMPT
    if long_prompt:
        logger.warning(
            "%s %s: %d input tokens, past %d",
            finding.pair_id,
            finding.regulation,
            usage.input_tokens,
            LONG_PROMPT,
        )
    standard, past_long_prompt = PRICES[MODEL]
    input_price, output_price = past_long_prompt if long_prompt else standard
    row: dict[str, object] = {
        **{
            key: value
            for key, value in asdict(finding).items()
            if key in COLUMNS
        },
        **(answer.model_dump() if answer else {}),
        "error": error,
        "model": MODEL,
        "prompt_version": PROMPT["version"],
        "extractor_version": EXTRACTOR_VERSION,
        "stop_reason": response.stop_reason,
        "input_tokens": usage.input_tokens,
        "output_tokens": usage.output_tokens,
        "cost_usd": round(
            (
                usage.input_tokens * input_price
                + usage.output_tokens * output_price
            )
            / 1_000_000,
            6,
        ),
    }
    raw: dict[str, Any] = {
        "request": {
            "model": MODEL,
            "max_tokens": MAX_TOKENS,
            "effort": EFFORT,
            "prompt_version": PROMPT["version"],
            "extractor_version": EXTRACTOR_VERSION,
            "finding": asdict(finding),
            "user_prompt_sha256": hashlib.sha256(
                prompt.user.encode()
            ).hexdigest(),
        },
        "response": response.to_dict(),
    }
    return row, raw


def run(
    connection: Connection,
    client: anthropic.Anthropic,
    pairs: Sequence[dict[str, str]],
    out: Path,
) -> float:
    """Predicts every finding, writing rows as they come; returns the cost."""
    (out / "raw").mkdir(parents=True, exist_ok=True)
    cost = 0.0
    with (out / "predictions.csv").open("w", newline="") as file:
        writer = csv.DictWriter(file, COLUMNS)
        writer.writeheader()
        for finding in findings(connection, pairs):
            row, raw = predict(
                client, finding, build_prompt(connection, finding)
            )
            name = f"{finding.pair_id}-{finding.regulation.replace(' ', '-')}"
            (out / "raw" / f"{name}.json").write_text(json.dumps(raw, indent=2))
            writer.writerow(row)
            file.flush()
            cost += float(str(row["cost_usd"]))
            logger.info("%s: %s", name, row["error"] or "valid")
    return cost


def main(argv: Sequence[str] | None = None) -> int:
    """Connects through libpq settings and the SDK's own credentials."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pairs", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    try:
        pairs = read_pairs(args.pairs)
        with psycopg.connect(autocommit=True) as connection:
            cost = run(connection, anthropic.Anthropic(), pairs, args.out)
    except (ValueError, psycopg.Error, anthropic.APIError) as error:
        logger.error("%s", error)
        return 1
    logger.info("cost $%.2f", cost)
    return 0


if __name__ == "__main__":
    sys.exit(main())
