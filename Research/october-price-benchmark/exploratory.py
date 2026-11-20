"""Exploratory, nested held-out comparisons for the frozen October price list."""
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pymupdf
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import Ridge
from sklearn.model_selection import GridSearchCV, GroupKFold, KFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from benchmark import HERE, RAW, INPUT_ROOT, price_rows, source

ROOT = INPUT_ROOT
FEATURES = ["Garden", "Activities room", "Hairdressing/beauty salon"]
MODEL_FEATURES = ["Garden"]
FACILITY_TERMS = [r"\bgardens?\b", r"\bactivit(?:y|ies) rooms?\b", r"\bsalons?\b"]
SEED = 20261118


def save_csv(path, rows):
    with path.open("w", newline="", encoding="utf-8") as out:
        writer = csv.DictWriter(out, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def normalise(text):
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def load_data():
    register = list(csv.DictReader(source(
        "870ca9905d4ca22fc55adeeed3c1a5d6539ec445604ff88fa3c85bedc5ef53a2"
    ).decode("utf-8-sig").splitlines(keepends=True)))
    by_id = {r["Centre_ID"]: r for r in register}
    assert len(by_id) == len(register)
    rows = []
    for ident, county, rate in price_rows():
        r = by_id[ident]
        capacity = int(r["Maximum_Occupancy"])
        assert capacity > 0
        rows.append(dict(hiqa_id=ident, county=county, weekly_rate=rate,
                         capacity=capacity, provider=r["Registration_Provider"].strip() or ident))
    return rows


def audit_features(rows):
    manifest = {}
    for line in (ROOT / "data/manifests/inspection-reports.jsonl").read_text(encoding="utf-8").splitlines():
        record = json.loads(line)
        for report in record.get("reports", []):
            manifest[(record["centre_id"], report.get("sha256"))] = report
    files = defaultdict(list)
    for path in (ROOT / "data/amenities/amenities-v2").rglob("*.json"):
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data["extractor_version"] == "amenities-v2"
        files[data["centre_id"]].append((path, data))
    audit = []
    checks = []
    subset = []
    for row in rows:
        entries = files[row["hiqa_id"]]
        record = dict(hiqa_id=row["hiqa_id"], status="missing_v2", published_date="",
                      inspection_date="", extraction_path="", sha256="")
        if entries:
            path, data = max(entries, key=lambda x: x[1]["inspection_date"])
            report = manifest.get((row["hiqa_id"], data["sha256"]), {})
            publication = report.get("published_date") or ""
            record.update(published_date=publication, inspection_date=data["inspection_date"],
                          extraction_path=str(path.relative_to(ROOT)), sha256=data["sha256"])
            record["status"] = "publication_unknown"
            if publication:
                record["status"] = "post_cutoff" if publication > "2026-10-14" else "eligible"
            pdf_path = RAW / data["sha256"][:2] / data["sha256"]
            if record["status"] == "eligible" and not pdf_path.exists():
                record["status"] = "source_pdf_missing"
            if record["status"] == "eligible":
                pdf = pymupdf.open(stream=source(data["sha256"]), filetype="pdf")
                values = []
                for name, term in zip(FEATURES, FACILITY_TERMS, strict=True):
                    items = [i for i in data["amenities"]["facilities"] if i["item"] == name]
                    evidence_ok = True
                    for item in items:
                        evidence = item.get("evidence", [])
                        evidence_ok = evidence_ok and bool(evidence)
                        named_facility = False
                        for e in evidence:
                            start, end = e["page_start"], e["page_end"]
                            valid_pages = 1 <= start <= end <= len(pdf)
                            text = " ".join(pdf[p].get_text() for p in range(start-1, end)) if valid_pages else ""
                            matched = valid_pages and normalise(e["quote"]) in normalise(text)
                            named_facility = named_facility or bool(re.search(term, normalise(e["quote"])))
                            evidence_ok = evidence_ok and matched
                            checks.append(dict(hiqa_id=row["hiqa_id"], feature=name,
                                               page_start=start, page_end=end, quote=e["quote"],
                                               quote_on_pages=matched, names_facility=bool(re.search(term, normalise(e["quote"])))) )
                        evidence_ok = evidence_ok and named_facility
                    state = "documented" if items and evidence_ok else "unmentioned" if not items else "unverified_evidence"
                    record[name] = state
                    if name in MODEL_FEATURES:
                        values.append(int(bool(items)) if evidence_ok else None)
                if None in values:
                    record["status"] = "evidence_check_failed"
                else:
                    subset.append(dict(row, features=values))
        for name in FEATURES:
            record.setdefault(name, "missing")
        audit.append(record)
    save_csv(HERE / "feature-audit.csv", audit)
    save_csv(HERE / "evidence-checks.csv", checks)
    return subset, Counter(r["status"] for r in audit)


def estimator(extra_columns):
    preprocessing = ColumnTransformer([
        ("county", OneHotEncoder(handle_unknown="ignore", sparse_output=False), [0]),
        ("numeric", StandardScaler(), list(range(1, extra_columns+1))),
    ], remainder="drop")
    return Pipeline([("prepare", preprocessing), ("ridge", Ridge())])


def evaluate(rows, grouped, include_capacity, include_features):
    extra = int(include_capacity) + len(MODEL_FEATURES) * int(include_features)
    x = np.array([[r["county"]] + ([np.log(r["capacity"])] if include_capacity else [])
                  + (r["features"] if include_features else []) for r in rows], dtype=object)
    y = np.array([r["weekly_rate"] for r in rows])
    groups = np.array([r["provider"] for r in rows])
    outer = GroupKFold(n_splits=5) if grouped else KFold(n_splits=5, shuffle=True, random_state=SEED)
    predictions = np.empty(len(rows))
    folds = np.empty(len(rows), dtype=int)
    selected = []
    for fold, (train, test) in enumerate(outer.split(x, y, groups if grouped else None), 1):
        inner = GroupKFold(n_splits=3) if grouped else KFold(n_splits=3, shuffle=True, random_state=SEED)
        splits = list(inner.split(x[train], y[train], groups[train] if grouped else None))
        search = GridSearchCV(estimator(extra), {"ridge__alpha": [0.1, 1, 10, 100]},
                              scoring="neg_mean_absolute_error", cv=splits, n_jobs=1)
        search.fit(x[train], y[train])
        predictions[test] = search.predict(x[test])
        folds[test] = fold
        selected.append(search.best_params_["ridge__alpha"])
        if grouped:
            assert not set(groups[train]) & set(groups[test])
    return predictions, folds, selected


def interval(values, groups):
    unique = sorted(set(groups))
    buckets = [np.flatnonzero(np.array(groups) == g) for g in unique]
    rng = np.random.default_rng(SEED)
    boot = []
    for _ in range(5000):
        indices = np.concatenate([buckets[i] for i in rng.integers(0, len(buckets), len(buckets))])
        boot.append(np.mean(values[indices]))
    return np.quantile(boot, [0.025, 0.975])


def main():
    inputs = sorted((ROOT / "data/amenities/amenities-v2").rglob("*.json"))
    inputs.extend(ROOT / "data/manifests" / name for name in
                  ["inspection-reports.jsonl", "price-lists.jsonl", "register-snapshots.jsonl"])
    save_csv(HERE / "input-hashes.csv", [dict(
        path=str(path.relative_to(ROOT)), sha256=hashlib.sha256(path.read_bytes()).hexdigest()
    ) for path in inputs])
    rows = load_data()
    subset, audit = audit_features(rows)
    counts = Counter(r["provider"] for r in rows)
    print("Provider groups", len(counts), "homes in shared exact strings",
          sum(n for n in counts.values() if n > 1), "largest", max(counts.values()))
    print("Feature audit", audit, "eligible", len(subset))
    print("Feature positive counts", dict(zip(MODEL_FEATURES, np.sum([r["features"] for r in subset], axis=0).tolist())))
    results, predictions = [], []
    for sample, data in [("All priced homes", rows), ("Source-checked Dublin v2 subset", subset)]:
        for grouped in [False, True]:
            models = [("County", False, False), ("County + log capacity", True, False)]
            if sample != "All priced homes":
                models.append(("County + log capacity + documented garden", True, True))
            baseline_loss = None
            previous_loss = None
            for label, capacity, features in models:
                pred, fold, alphas = evaluate(data, grouped, capacity, features)
                loss = np.abs(np.array([r["weekly_rate"] for r in data])-pred)
                groups = [r["provider"] for r in data]
                mae_interval = interval(loss, groups)
                if baseline_loss is None:
                    baseline_loss = loss
                gain = baseline_loss-loss
                ci = interval(gain, groups)
                previous_gain = np.zeros(len(data)) if previous_loss is None else previous_loss-loss
                pci = interval(previous_gain, groups)
                results.append(dict(sample=sample, evaluation="Provider grouped" if grouped else "Home shuffled",
                                    model=label, n=len(data), mae=loss.mean(),
                                    mae_low=mae_interval[0], mae_high=mae_interval[1],
                                    gain_vs_county=gain.mean(), gain_low=ci[0], gain_high=ci[1],
                                    gain_vs_previous=previous_gain.mean(), previous_low=pci[0], previous_high=pci[1],
                                    selected_alphas=str(alphas)))
                for r, p, f in zip(data, pred, fold, strict=True):
                    predictions.append(dict(sample=sample, evaluation=results[-1]["evaluation"], model=label,
                                            hiqa_id=r["hiqa_id"], fold=f, observed=r["weekly_rate"], prediction=p))
                previous_loss = loss
    save_csv(HERE / "model-results.csv", results)
    save_csv(HERE / "model-predictions.csv", predictions)
    print(json.dumps(results, indent=2))
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.5), layout="constrained")
    for ax, sample in zip(axes, ["All priced homes", "Source-checked Dublin v2 subset"]):
        chosen = [r for r in results if r["sample"] == sample]
        for offset, evaluation, color in [(-0.17, "Home shuffled", "#246a91"),
                                           (0.17, "Provider grouped", "#d27b32")]:
            points = [r for r in chosen if r["evaluation"] == evaluation]
            x = np.arange(len(points))+offset
            ax.bar(x, [r["mae"] for r in points], width=.32, color=color, label=evaluation)
            ax.errorbar(x, [r["mae"] for r in points],
                        yerr=[[r["mae"]-r["mae_low"] for r in points],
                              [r["mae_high"]-r["mae"] for r in points]], fmt="none", color="#222222", capsize=3)
        labels = ["County", "+ capacity"] + (["+ garden"] if sample != "All priced homes" else [])
        ax.set_xticks(range(len(labels)), labels)
        ax.set_title(sample + f" (n={chosen[0]['n']})")
        ax.set_ylabel("Mean absolute error (€ per week)")
        ax.set_ylim(0, 40)
        ax.legend(frameon=False, fontsize=8, loc="upper left")
        ax.spines[["top", "right"]].set_visible(False)
    fig.suptitle("Exploratory October 2026 price estimates\nFive outer folds; provider-cluster bootstrap intervals", fontsize=13)
    fig.savefig(HERE / "model-comparison.png", dpi=180)
    (HERE / "audit-summary.json").write_text(json.dumps(dict(
        providers=len(counts), shared_provider_homes=sum(n for n in counts.values() if n > 1),
        largest_exact_provider_group=max(counts.values()), screened_features=list(FEATURES), model_features=MODEL_FEATURES,
        feature_status=dict(audit), feature_n=len(subset)), indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
