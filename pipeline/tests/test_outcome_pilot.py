"""The outcome pilot's prompt and its checks on the model's answers."""

import json
from typing import Any

import anthropic
import httpx2
import pytest

from clearcare_pipeline.outcome_pilot import (
    MODEL,
    PRICES,
    Finding,
    Prompt,
    build_prompt,
    findings,
    predict,
)
from clearcare_pipeline.parser.text import EXTRACTOR_VERSION, ReportText
from tests.database import PIPELINE, migrated_database

NEXT_NARRATIVE = (
    "Regulation 5: Individual assessment and care plan\n"
    "Care plans were reviewed and updated since the last inspection.\n"
    "Judgment: Compliant"
)
# HIQA often follows up the last inspection in a section's summary.
FOLLOW_UP = (
    "The issues identified at the last inspection in relation to care plans"
    " had been addressed in full."
)


@pytest.mark.database
def test_prompt_holds_the_finding_its_response_and_the_next_reports_pages() -> (
    None
):
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        connection.execute(
            "INSERT INTO clearcare.centre (centre_id) VALUES ('117')"
        )
        report_ids: list[int] = []
        for sha, fieldwork_id, inspected in (
            ("ab" * 32, "MON-0000001", "2024-02-15"),
            ("cd" * 32, "MON-0000002", "2024-09-10"),
        ):
            report = connection.execute(
                "WITH source AS (INSERT INTO clearcare.source_file"
                " (source, url, sha256, fetched_at) VALUES"
                " ('inspection-reports', 'https://example.test/r.pdf', %s,"
                " now()) RETURNING source_file_id)"
                " INSERT INTO clearcare.inspection_report (source_file_id,"
                " centre_id, centre_code, centre_name, address,"
                " inspection_date, fieldwork_id) SELECT source_file_id, '117',"
                " 'OSV-0000117', 'Fern Valley', 'Sample Street', %s, %s"
                " FROM source RETURNING id",
                (sha, inspected, fieldwork_id),
            ).fetchone()
            assert report is not None
            report_ids.append(report[0])
        finding_id, next_id = report_ids
        connection.execute(
            "INSERT INTO clearcare.inspection_regulation"
            " (report_id, regulation, title, judgment) VALUES"
            " (%(f)s, 'Regulation 5', 'Individual assessment and care plan',"
            " 'Not compliant'),"
            " (%(f)s, 'Regulation 9', 'Residents'' rights', 'Compliant')",
            {"f": finding_id},
        )
        # Report, kind, regulation, first page, text and page offsets.
        text_rows: list[tuple[int, str, str | None, int, str, list[int]]] = [
            (finding_id, "narrative", "Regulation 5", 9, "Plans were old.", []),
            (finding_id, "response", "Regulation 5", 30, "We will review.", []),
            (next_id, "intro", None, 5, "The centre was inspected.", []),
            (next_id, "quality_summary", None, 7, FOLLOW_UP, []),
            (next_id, "narrative", "Regulation 5", 7, NEXT_NARRATIVE, [50]),
        ]
        with connection.cursor() as cursor:
            cursor.executemany(
                "INSERT INTO clearcare.inspection_report_text (report_id,"
                " kind, regulation, first_page, last_page, text,"
                " page_offsets, extractor_version)"
                " VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                [
                    (
                        report,
                        kind,
                        regulation,
                        page,
                        page + len(offsets),
                        text,
                        offsets,
                        EXTRACTOR_VERSION,
                    )
                    for report, kind, regulation, page, text, offsets in (
                        text_rows
                    )
                ],
            )

        [finding] = findings(
            connection,
            [
                {
                    "pair_id": "P1",
                    "finding_report_id": str(finding_id),
                    "next_report_id": str(next_id),
                }
            ],
        )
        prompt = build_prompt(connection, finding)

    assert (finding.regulation, finding.judgment) == (
        "Regulation 5",
        "Not compliant",
    )
    assert "Regulation 5: Individual assessment and care plan" in prompt.user
    assert "We will review." in prompt.user
    assert "[page 5]\nThe centre was inspected." in prompt.user
    # The narrative runs from page 7 onto page 8 at its stored offset.
    assert "[page 7]\nRegulation 5:" in prompt.user
    assert "[page 8]\nCare plans were reviewed" in prompt.user
    # The summary comes in reading order, before the section's narratives.
    assert FOLLOW_UP in prompt.user
    assert prompt.user.index(FOLLOW_UP) < prompt.user.index("[page 7]\nRegul")
    assert [part.text for part in prompt.next_report] == [
        "The centre was inspected.",
        FOLLOW_UP,
        NEXT_NARRATIVE,
    ]


def _fake_client(
    answers: list[dict[str, Any]],
) -> tuple[anthropic.Anthropic, list[dict[str, Any]]]:
    """Answers each request with the next answer, as the API would."""
    requests: list[dict[str, Any]] = []

    def respond(request: httpx2.Request) -> httpx2.Response:
        requests.append(json.loads(request.content))
        return httpx2.Response(
            200,
            json={
                "id": f"msg_{len(requests)}",
                "type": "message",
                "role": "assistant",
                "model": MODEL,
                "content": [
                    {"type": "text", "text": json.dumps(answers.pop(0))}
                ],
                "stop_reason": "end_turn",
                "stop_sequence": None,
                "usage": {"input_tokens": 12_000, "output_tokens": 2_000},
            },
        )

    client = anthropic.Anthropic(
        api_key="test",
        max_retries=0,
        http_client=httpx2.Client(transport=httpx2.MockTransport(respond)),
    )
    return client, requests


def test_answers_are_checked_against_the_schema_and_the_next_report() -> None:
    finding = Finding("P1", 1, "Regulation 5", "Not compliant", 2, "", "", "")
    page_7 = "The provider had reviewed every plan.\n"
    prompt = Prompt(
        "The prompt",
        (
            ReportText(
                "narrative",
                "Regulation 5",
                7,
                8,
                page_7 + "Residents\u2019 care plans were reviewed"
                " \u2013 and\nupdated.",
                (len(page_7),),
            ),
        ),
    )
    good = {
        "re_assessment": "improved",
        "next_judgment": "Compliant",
        "reported_outcome": "done",
        # Copied with a space where the stored text breaks the line, and a
        # straight apostrophe and hyphen for its curly one and en dash.
        "evidence_quote": "Residents' care plans were reviewed - and updated.",
        "evidence_page": 8,
        "confidence": "high",
    }
    bad_answers = {
        "quote: not found in the next report": {
            **good,
            "evidence_quote": "All care plans are now complete.",
        },
        "page: the quote starts on page 8, not 7": {**good, "evidence_page": 7},
        "quote: blank": {**good, "evidence_quote": " "},
        "page: a quote needs its page, and a page its quote": {
            **good,
            "evidence_page": None,
        },
        "next_judgment: missing although re-assessed": {
            **good,
            "next_judgment": None,
        },
        "next_judgment: given although not re-assessed": {
            **good,
            "re_assessment": "not re-assessed",
        },
        "schema: confidence Input should be 'low', 'medium' or 'high'": {
            **good,
            "confidence": "certain",
        },
    }
    client, requests = _fake_client([good, *bad_answers.values()])

    row, raw = predict(client, finding, prompt)
    errors = [predict(client, finding, prompt)[0]["error"] for _ in bad_answers]

    assert row["error"] == ""
    assert (row["re_assessment"], row["reported_outcome"]) == (
        "improved",
        "done",
    )
    assert (row["model"], row["input_tokens"], row["output_tokens"]) == (
        MODEL,
        12_000,
        2_000,
    )
    input_price, output_price = PRICES[MODEL][0]
    assert row["cost_usd"] == pytest.approx(
        (12_000 * input_price + 2_000 * output_price) / 1_000_000
    )
    assert raw["response"]["id"] == "msg_1"
    assert errors == list(bad_answers)
    assert requests[0]["model"] == MODEL
    assert "temperature" not in requests[0]
    assert requests[0]["output_config"]["format"]["type"] == "json_schema"
