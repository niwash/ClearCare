"""Reproduce the October benchmark from the project's frozen source objects."""
import csv
import hashlib
import random
import re
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean, median, quantiles

import pymupdf

HERE = Path(__file__).resolve().parent
from prepare_inputs import prepare_inputs

INPUT_ROOT = prepare_inputs()
RAW = INPUT_ROOT / "data/raw/sha256"


def source(digest):
    data = (RAW / digest[:2] / digest).read_bytes()
    assert hashlib.sha256(data).hexdigest() == digest
    return data


def price_rows():
    pdf = source("4815bafb52d02ca23c6572c62b9dca35056a47e38a04dbfa5501066ccec8e0f8")
    county = None
    homes = []
    for page in pymupdf.open(stream=pdf, filetype="pdf"):
        words = page.get_text("words")
        headings = defaultdict(list)
        for x, y, _, _, word, *_ in words:
            if x < 130:
                headings[round(y)].append(word)
        ids = [w for w in words if 270 < w[0] < 330 and w[4].isdigit()]
        prices = [w for w in words if re.fullmatch(r"€[\d,]+", w[4])]
        assert len(ids) == len(prices)
        for ident, price in zip(ids, prices, strict=True):
            assert abs(ident[1] - price[1]) < 3
            label = " ".join(headings[round(ident[1])])
            if label:
                county = re.fullmatch(r"Co\.\s*(\w+)", label).group(1)
            assert county
            homes.append((ident[4], county, int(price[4][1:].replace(",", ""))))
    assert len(homes) == len(set(r[0] for r in homes)) == 411
    return homes


def main():
    homes = price_rows()
    register = source("870ca9905d4ca22fc55adeeed3c1a5d6539ec445604ff88fa3c85bedc5ef53a2")
    by_id = defaultdict(list)
    for row in csv.DictReader(register.decode("utf-8-sig").splitlines(keepends=True)):
        by_id[row["Centre_ID"]].append(row["Maximum_Occupancy"])
    losses = []
    counts = Counter()
    with (HERE / "held-out.csv").open("w", newline="", encoding="utf-8") as out:
        writer = csv.writer(out)
        writer.writerow(["hiqa_id", "county", "weekly_rate", "oct26_register_status",
                         "county_training_n", "fallback", "national_prediction",
                         "region_prediction", "county_prediction"])
        for ident, county, rate in homes:
            peers = [h for h in homes if h[0] != ident]
            regional = [r for _, c, r in peers if (c == "Dublin") == (county == "Dublin")]
            local = [r for _, c, r in peers if c == county]
            fallback = len(local) < 5
            preds = [median([r for _, _, r in peers]), median(regional),
                     median(regional if fallback else local)]
            caps = by_id[ident]
            status = ("unmatched" if not caps else "ambiguous" if len(caps) > 1 else
                      "positive" if caps[0].isdigit() and int(caps[0]) > 0 else "missing")
            counts[status] += 1
            counts["fallback"] += fallback
            writer.writerow([ident, county, rate, status, len(local), fallback, *preds])
            losses.append([abs(p-rate) for p in preds])
    rates = [r for _, _, r in homes]
    print("range, median", min(rates), max(rates), median(rates), counts)
    for dublin in [True, False]:
        subset = [r for _, c, r in homes if (c == "Dublin") == dublin]
        print("Dublin", dublin, len(subset), mean(subset))
    for i in range(3):
        delta = [e[1]-e[i] for e in losses]
        rng = random.Random(20261117)
        samples = [sum(rng.choices(delta, k=len(delta)))/len(delta) for _ in range(10000)]
        q = quantiles(samples, n=1000, method="inclusive")
        print(i, "MAE, gain vs region, paired interval", mean(e[i] for e in losses),
              mean(delta), q[24], q[974])


if __name__ == "__main__":
    main()
