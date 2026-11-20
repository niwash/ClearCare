"""Rebuild the frozen study with Python 3.14; no third-party dependencies."""
import csv
import hashlib
import json
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

OUT = Path(__file__).resolve().parent
SNAPSHOT = OUT / "snapshot.zip"
C, S, N = "Compliant", "Substantially compliant", "Not compliant"
OMIT, LAST = "not re-assessed", "no later report"


def run():
    expected = (OUT / "snapshot.sha256").read_text().split()[0]
    assert hashlib.sha256(SNAPSHOT.read_bytes()).hexdigest() == expected, "Snapshot checksum mismatch"
    with zipfile.ZipFile(SNAPSHOT) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        for name, metadata in manifest["files"].items():
            assert hashlib.sha256(archive.read(name)).hexdigest() == metadata["sha256"], name
        stats = json.loads(archive.read("statistics.json"))
        inventory = []
        reports = []
        for name in sorted(n for n in archive.namelist() if n.startswith("inventory/")):
            listing = json.loads(archive.read(name))
            for report in listing["reports"]:
                detail = json.loads(archive.read(f"reports/{report['report_id']}.json"))
                assert (detail["centre_id"], detail["inspection_date"], detail["report_id"]) == (listing["centre_id"], report["inspection_date"], report["report_id"])
                reports.append(detail)
                inventory.append(report["report_id"])
    assert len(inventory) == len(set(inventory)) == stats["coverage"]["reports_loaded"]
    histories = defaultdict(lambda: defaultdict(list))
    for report in reports:
        if report["inspection_date"]:
            histories[report["centre_id"]][report["inspection_date"]].append(report)
    matrix = defaultdict(Counter)
    groups = defaultdict(list)
    by_start = defaultdict(list)
    by_reg_start = defaultdict(list)
    period = []
    digest = hashlib.sha256()
    for home, days in histories.items():
        dates = sorted(days)
        for i, date in enumerate(dates):
            following = days[dates[i+1]] if i+1 < len(dates) else []
            if len(following) > 1:
                continue
            def judgments(report):
                values = {}
                for row in report["regulations"]:
                    values.setdefault(row["regulation"], row["judgment"])
                return values
            later = judgments(following[0]) if following else {}
            for report in days[date]:
                for reg, start in judgments(report).items():
                    result = later.get(reg, OMIT) if following else LAST
                    if following and following[0]["inspection_date"] >= "2026-01-01" and result in (C,S,N):
                        period.append((home, reg, result))
                    matrix[start][result] += 1
                    groups[reg].append((home, result))
                    by_start[start].append((home, result))
                    by_reg_start[(reg, start)].append((home, result))
                    record = [home,report["report_id"],following[0]["report_id"] if following else None,reg,start,result]
                    digest.update((json.dumps(record)+"\n").encode())
    keys = ["compliant","substantially_compliant","not_compliant","not_re_assessed","no_later_report"]
    for row in stats["matrix"]:
        counts = matrix[row["judgment"]]
        assert [counts[k] for k in (C,S,N,OMIT,LAST)] == [row[k] for k in keys]
    assert sum(map(len,groups.values())) == sum(r["total"] for r in stats["matrix"])
    with (OUT/"denominators.csv").open("w",newline="",encoding="utf8") as file:
        writer = csv.writer(file)
        writer.writerow(["regulation","starting_judgments","with_later_report","reassessed","later_compliant","later_substantially_compliant","later_not_compliant","omitted","no_later_report","homes_start","homes_followup","homes_reassessed","homes_later_not_compliant","homes_later_compliant","homes_later_substantially_compliant"])
        for reg, records in sorted(groups.items()):
            counts = Counter(r for _,r in records)
            def homes(allowed):
                return len({h for h,r in records if r in allowed})
            writer.writerow([reg,len(records),len(records)-counts[LAST],sum(counts[k] for k in (C,S,N)),*[counts[k] for k in (C,S,N,OMIT,LAST)],homes(counts),homes((C,S,N,OMIT)),homes((C,S,N)),homes((N,)),homes((C,)),homes((S,))])
    for filename, grouped in (("by-earlier-judgment.csv", by_start), ("by-regulation-and-earlier-judgment.csv", by_reg_start)):
        with (OUT / filename).open("w", newline="", encoding="utf8") as file:
            writer = csv.writer(file)
            labels = ["regulation", "earlier_judgment"] if grouped is by_reg_start else ["earlier_judgment"]
            writer.writerow(labels + ["starting_judgments", "with_later_report", "reassessed", "later_compliant", "later_substantially_compliant", "later_not_compliant", "omitted", "no_later_report", "homes_start", "homes_followup", "homes_reassessed", "homes_later_not_compliant","homes_later_compliant","homes_later_substantially_compliant"])
            for key, records in sorted(grouped.items()):
                counts = Counter(result for _, result in records)
                def homes(allowed):
                    return len({home for home, result in records if result in allowed})
                row_labels = list(key) if isinstance(key, tuple) else [key]
                writer.writerow(row_labels + [len(records), len(records)-counts[LAST], sum(counts[k] for k in (C,S,N)), *[counts[k] for k in (C,S,N,OMIT,LAST)], homes(counts), homes((C,S,N,OMIT)), homes((C,S,N)), homes((N,)),homes((C,)),homes((S,))])
    positive = [(home, reg) for home,reg,result in period if result == N]
    print("2026 dated later outcomes / homes / positive / positive homes:", len(period), len({h for h,_,_ in period}), len(positive), len({h for h,_ in positive}))
    print("Regulations with 2026 positives:", Counter(r for _,r in positive))
    print("Paired row stream SHA256", digest.hexdigest())
    print(json.dumps(stats))

if __name__ == "__main__":
    run()
