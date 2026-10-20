"""Print pairs.csv from the frozen candidates.csv using only Python's stdlib."""

import csv
import sys
from collections import defaultdict
from pathlib import Path

with (
    Path(__file__)
    .with_name("candidates.csv")
    .open(newline="", encoding="utf-8") as source
):
    reports = list(csv.DictReader(source))
by_centre = defaultdict(list)
for report in reports:
    by_centre[report["centre_id"]].append(report)
eligible = []
for group in by_centre.values():
    group.sort(key=lambda r: (r["inspection_date"], r["fieldwork_id"], r["sha256"]))
    assert len({r["inspection_date"] for r in group}) == len(group), "Date tie"
    for i, report in enumerate(group[:-2]):
        if int(report["sc_nc_findings"]) > 0:
            eligible.append((report, group[i + 1], len(group) - i - 1))
eligible.sort(key=lambda p: (p[0]["sha256"], p[0]["centre_id"], p[0]["fieldwork_id"]))
selected, centres, years = [], set(), set()
for distinct_year in (True, False):
    for candidate in eligible:
        report = candidate[0]
        year = report["inspection_date"][:4]
        if len(selected) == 5:
            break
        if report["centre_id"] in centres or (distinct_year and year in years):
            continue
        selected.append(candidate)
        centres.add(report["centre_id"])
        years.add(year)
assert len(selected) == 5, "Fewer than five qualifying centres"
fields = (
    "pair_id centre_id centre_name finding_report_id finding_fieldwork_id "
    "finding_date finding_pdf next_report_id next_fieldwork_id next_date "
    "next_pdf sc_nc_findings later_reports_available"
).split()
writer = csv.writer(sys.stdout, lineterminator="\n")
writer.writerow(fields)
for number, (report, following, later) in enumerate(selected, 1):
    writer.writerow(
        [
            f"CCARE-113-{number:02}",
            report["centre_id"],
            report["centre_name"],
            report["report_id"],
            report["fieldwork_id"],
            report["inspection_date"],
            report["pdf_url"],
            following["report_id"],
            following["fieldwork_id"],
            following["inspection_date"],
            following["pdf_url"],
            report["sc_nc_findings"],
            later,
        ]
    )
