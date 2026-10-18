"""Agreement between labelled findings and the outcome pilot's predictions."""

from collections import Counter

from clearcare_pipeline.score_outcomes import agreement, report


def _row(regulation: str, **values: str) -> dict[str, str]:
    return {
        "pair_id": "P1",
        "finding_report_id": "259",
        "regulation": regulation,
        "re_assessment": "",
        "reported_outcome": "",
        **values,
    }


LABELS = [
    _row("Regulation 5", re_assessment="improved", reported_outcome="done"),
    _row(
        "Regulation 6",
        re_assessment="unchanged",
        reported_outcome="no statement found",
    ),
    # Labelled on one axis only.
    _row("Regulation 9", re_assessment="improved"),
]

PREDICTIONS = [
    _row(
        "Regulation 5",
        re_assessment="improved",
        reported_outcome="done",
        error="",
        input_tokens="10000",
        output_tokens="2000",
        cost_usd="0.002",
    ),
    _row(
        "Regulation 6",
        re_assessment="improved",
        reported_outcome="no statement found",
        error="quote: not found in the next report",
        input_tokens="10000",
        output_tokens="2000",
        cost_usd="0.002",
    ),
    # A schema failure leaves the answer empty.
    _row(
        "Regulation 9",
        error="schema: confidence Input should be 'low', 'medium' or 'high'",
        input_tokens="10000",
        output_tokens="1000",
        cost_usd="0.0015",
    ),
]


def test_agreement_counts_each_labelled_finding_once_per_axis() -> None:
    re_assessment = agreement(LABELS, PREDICTIONS, "re_assessment")
    outcome = agreement(LABELS, PREDICTIONS, "reported_outcome")

    assert (re_assessment.agree, re_assessment.labelled) == (1, 3)
    assert re_assessment.confusion == Counter(
        {
            ("improved", "improved"): 1,
            ("unchanged", "improved"): 1,
            ("improved", "(none)"): 1,
        }
    )
    assert (outcome.agree, outcome.labelled) == (2, 2)
    text = report(LABELS, PREDICTIONS)
    assert "re_assessment: 1 of 3 labelled findings agree (33%)" in text
    assert "reported_outcome: 2 of 2 labelled findings agree (100%)" in text
    assert "Invalid outputs: 2 of 3\n  quote: 1\n  schema: 1" in text
    assert "Cost: $0.0055 for 30,000 input and 5,000 output tokens" in text
