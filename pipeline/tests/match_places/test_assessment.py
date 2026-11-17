"""The rule, replayed against the assessment of all 546 centres.

The fixture is the outcome of CCARE-209's assessment, which found each listing
by searching by name. It pins the thresholds: change a comparison and the rows
that moved are named here. The pipeline now finds listings by proximity, so its
own coverage is measured by a run of the stage; this fixture says the rule still
decides the same way on the data the proposal published.
"""

import json
from pathlib import Path
from typing import TypedDict

from clearcare_pipeline.match_places.__main__ import MAX_DISTANCE_M
from clearcare_pipeline.match_places.names import agrees


class Row(TypedDict):
    """One centre's assessment: the listing chosen, and the decision made."""

    centre_name: str
    google_name: str
    distance_m: int
    photo_count: int
    approved: bool


FIXTURE = Path(__file__).parent / "fixtures" / "assessment.json"
# The assessment covered 546 centres; three had no listing to decide about.
ASSESSED = 543
# What the proposal says the rule approves. Change one, change the other.
APPROVED = 324


def test_the_rule_reproduces_the_assessment() -> None:
    rows: list[Row] = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert len(rows) == ASSESSED
    approved = 0
    disagreements: list[Row] = []
    for row in rows:
        decided = (
            agrees(row["centre_name"], row["google_name"])
            and row["distance_m"] <= MAX_DISTANCE_M
            and row["photo_count"] >= 1
        )
        approved += decided
        if decided != row["approved"]:
            disagreements.append(row)
    assert disagreements == []
    assert approved == APPROVED
