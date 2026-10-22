"""Score the outcome pilot against labelled findings.

python -m clearcare_pipeline.score_outcomes --labels LABELS.csv \
    --predictions DIR/predictions.csv

LABELS.csv is a labelled copy of the CCARE-113 sheet 2. Prints the agreement
on each axis with its confusion table, the invalid outputs and the cost.
"""

import argparse
import csv
import logging
import sys
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

KEYS = ("pair_id", "finding_report_id", "regulation")
AXES = ("re_assessment", "reported_outcome")
# The prediction when the pilot has no answer for a labelled finding.
NONE = "(none)"

Row = dict[str, str]


@dataclass(frozen=True)
class Agreement:
    """How the predictions compare with the labels on one axis."""

    labelled: int
    agree: int
    confusion: Counter[tuple[str, str]]  # (label, prediction): findings


def _key(row: Row) -> tuple[str, ...]:
    return tuple(row[key] for key in KEYS)


def agreement(
    labels: Sequence[Row], predictions: Sequence[Row], axis: str
) -> Agreement:
    """Compares each finding labelled on this axis; blanks are skipped."""
    predicted = {_key(row): row[axis] or NONE for row in predictions}
    confusion = Counter(
        (label[axis], predicted.get(_key(label), NONE))
        for label in labels
        if label[axis]
    )
    agree = sum(
        count
        for (label, prediction), count in confusion.items()
        if label == prediction
    )
    return Agreement(confusion.total(), agree, confusion)


def _table(confusion: Counter[tuple[str, str]]) -> list[str]:
    """Labels down the side, predictions across the top."""
    labels = sorted({label for label, _ in confusion})
    predictions = sorted({prediction for _, prediction in confusion})
    corner = "label \\ predicted"
    width = max(len(corner), *map(len, labels))
    lines = ["  ".join([corner.ljust(width), *predictions])]
    for label in labels:
        counts = (
            str(confusion[label, prediction]).rjust(len(prediction))
            for prediction in predictions
        )
        lines.append("  ".join([label.ljust(width), *counts]))
    return lines


def report(labels: Sequence[Row], predictions: Sequence[Row]) -> str:
    """The text the command prints."""
    results = {axis: agreement(labels, predictions, axis) for axis in AXES}
    lines: list[str] = []
    if not any(result.labelled for result in results.values()):
        lines.append("No labels yet.")
    for axis, result in results.items():
        if result.labelled:
            lines.append(
                f"{axis}: {result.agree} of {result.labelled} labelled"
                f" findings agree ({result.agree / result.labelled:.0%})"
            )
            lines += [*_table(result.confusion), ""]
    # Each error starts with its kind: schema, quote or stop_reason.
    invalid = Counter(
        row["error"].split(":")[0] for row in predictions if row["error"]
    )
    lines.append(f"Invalid outputs: {invalid.total()} of {len(predictions)}")
    lines += [f"  {kind}: {count}" for kind, count in sorted(invalid.items())]
    cost = sum(float(row["cost_usd"]) for row in predictions)
    input_tokens = sum(int(row["input_tokens"]) for row in predictions)
    output_tokens = sum(int(row["output_tokens"]) for row in predictions)
    lines.append(
        f"Cost: ${cost:.4f} for {input_tokens:,} input"
        f" and {output_tokens:,} output tokens"
    )
    return "\n".join(lines)


def _read(path: Path, columns: Sequence[str]) -> list[Row]:
    with path.open(newline="") as file:
        reader = csv.DictReader(file)
        missing = [c for c in columns if c not in (reader.fieldnames or ())]
        if missing:
            raise ValueError(f"{path}: needs columns {', '.join(missing)}")
        return list(reader)


def main(argv: Sequence[str] | None = None) -> int:
    """Prints the scores; exits nonzero if a file lacks a needed column."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--labels", type=Path, required=True)
    parser.add_argument("--predictions", type=Path, required=True)
    args = parser.parse_args(argv)
    logging.basicConfig(format="%(levelname)s %(name)s: %(message)s")
    try:
        labels = _read(args.labels, (*KEYS, *AXES))
        predictions = _read(
            args.predictions,
            (
                *KEYS,
                *AXES,
                "error",
                "input_tokens",
                "output_tokens",
                "cost_usd",
            ),
        )
    except ValueError as error:
        logger.error("%s", error)
        return 1
    print(report(labels, predictions))
    return 0


if __name__ == "__main__":
    sys.exit(main())
