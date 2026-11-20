# Exploratory price study findings, 18 November 2026

The county benchmark reproduced on all 411 homes. In the regression comparison, adding log registered capacity increased held-out mean absolute error by €0.19 per week with shuffled home folds and €0.26 with exact provider strings held together. Neither paired interval establishes an improvement. A smaller Dublin-only garden comparison also showed no improvement from that feature.

## Results

All errors and improvements are euros per week. Positive improvement means lower error than the immediately preceding model within the same sample and evaluation. Parentheses contain 95% paired provider-cluster bootstrap intervals for that change.

| Sample and evaluation | Model | Homes | MAE | Improvement from preceding model |
|---|---|---:|---:|---:|
| National, leave one home out | National median | 411 | 49.47 | Reference |
| National, leave one home out | Dublin/outside median | 411 | 26.43 | 23.04 (18.87 to 27.31)* |
| National, leave one home out | County median with fallback | 411 | 20.40 | 6.03 (4.18 to 7.94)* |
| National, shuffled five folds | County regression | 411 | 21.17 | Reference |
| National, shuffled five folds | County + log capacity | 411 | 21.36 | −0.19 (−0.78 to 0.41) |
| National, provider grouped five folds | County regression | 411 | 21.56 | Reference |
| National, provider grouped five folds | County + log capacity | 411 | 21.82 | −0.26 (−0.87 to 0.35) |
| Dublin v2 subset, shuffled five folds | County regression | 63 | 23.51 | Reference |
| Dublin v2 subset, shuffled five folds | County + log capacity | 63 | 23.94 | −0.43 (−1.72 to 0.75) |
| Dublin v2 subset, shuffled five folds | County + log capacity + garden | 63 | 24.01 | −0.07 (−0.47 to 0.31) |
| Dublin v2 subset, provider grouped five folds | County regression | 63 | 23.29 | Reference |
| Dublin v2 subset, provider grouped five folds | County + log capacity | 63 | 22.62 | 0.67 (−0.50 to 1.83) |
| Dublin v2 subset, provider grouped five folds | County + log capacity + garden | 63 | 22.99 | −0.36 (−0.78 to 0.04) |

*The original median benchmarks retain their original home-level bootstrap. The new regression comparisons use provider clusters. Leave-one-out medians and five-fold regressions have different training sizes and methods, so their difference combines both effects.

## Inputs and coverage

The frozen HSE private/voluntary Section 40 list 231 is printed 14 October 2026, fetched 26 October, last modified 23 October. It contains 411 unique IDs, range €1,200 to €1,508 and median €1,290. Dublin has 86 homes with mean €1,415.85; the other 325 average €1,288.82. These are equally weighted listed weekly contract prices. [HSE source](https://www.hse.ie/documents/3223/HSE_Section40_List_231_Published_List_14.10.2026.pdf)

The HIQA register snapshot was fetched and last modified 26 October 2026. Every priced home matches exactly once with positive capacity, giving 411/411 coverage. Capacity and provider strings are measured twelve days after the printed rate list. Their historical values at the price cutoff remain unverified. This explicitly labelled cross-sectional exploration uses the near-dated snapshot. [HIQA export](https://www.hiqa.ie/centre/export/older_persons_register.csv?_format=csv)

There are 328 distinct exact provider strings among the priced homes. A total of 106 homes belong to strings shared by multiple homes, with 27 in the largest group. Grouped evaluation keeps every exact string entirely in training or test. Related legal entities may use different strings. This tests dependence under an observable grouping and cannot establish performance on unseen ownership chains.

Local v2 files cover 84 priced homes. Of these, 63 pass the garden evidence checks, or 15.3% of all prices and 73.3% of Dublin prices. All 63 are Dublin homes. Their reports were inspected between 31 July 2025 and 6 July 2026 and published between 22 October 2025 and 7 October 2026. All are existing GPT-4o-mini-2024-07-18 extractions made after the rate date. The remaining 327 priced homes lack local v2 files, and 21 fail the garden evidence check. The original files, v1 data and teammate human labels are preserved.

## Methods

The new experiments use the same deterministic outer folds for each model on a given sample. Home folds are five shuffled KFold splits with seed 20261118. Provider evaluation uses five GroupKFold splits on exact provider strings. Within each outer training set, three inner folds select ridge alpha from 0.1, 1, 10 and 100 by mean absolute error. Inner provider folds also keep strings together.

County one-hot encoding and numeric standardisation are fitted separately inside every inner training fold and then refitted on the outer training set. Unknown test counties receive an all-zero county vector. Numeric features are natural log capacity and, where eligible, the garden documentation indicator. Log transformation is fixed before fitting. No outcome-based feature screening or tuning uses outer test values. The functional form tests one simple capacity specification. On the Dublin-only subset, county is constant and its regression supplies a training-set mean.

We screened garden, activities room and hairdressing/beauty salon because they were common in existing files. The final garden indicator is 1 for an extraction with evidence that passes page bounds, normalised verbatim text matching and an explicit garden term, and 0 when the eligible extraction does not mention garden. Missing files and failed evidence remain unknown and are excluded from the matched facility comparison. Garden is documented for 50 of 63 eligible homes and unmentioned for 13. Unmentioned does not establish absence.

The other two feature tests were withheld after source checks found activities schedules or general day rooms cited for an activities room, and visiting hairdressing services cited for a salon. These observations are recorded in evidence-checks.csv and feature-audit.csv. This study neither supplies replacement human labels nor claims a validated facility detector. The checks verify source text and a narrow facility term. They do not establish extraction completeness or independently validate every semantic judgement. Conservative matching can reject valid paraphrases or ellipsis.

Uncertainty uses 5,000 paired bootstrap resamples of exact provider groups, seed 20261118. Each sampled group contributes all its homes. Error is weighted equally by home. The intervals condition on the fitted outer predictions and fold assignment, and omit refitting uncertainty, temporal shifts and unidentified ownership dependence. All numerical predictions, fold assignments and selected penalties are saved.

## Limitations

The capacity result concerns this ridge model with log capacity, county indicators and this edition of prices. A weak incremental result can coexist with an underlying capacity association. The small garden subset is Dublin-only and selected by local extraction availability and evidence quality. Its error cannot be compared with the national model as a feature effect. Reusing a single edition establishes neither causal pricing effects nor future accuracy. Registered capacity does not measure vacancies or individual suitability.

## Slide-ready points

- Geography supplies a strong benchmark. Leave-one-home-out error falls from €49.47 nationally to €26.43 using Dublin/outside groups and €20.40 using counties with a sparse-county fallback.
- Registered capacity links to all 411 homes. Adding log capacity to county regression changed held-out error from €21.17 to €21.36, with no supported improvement.
- Holding exact provider strings together gave the same conclusion, €21.56 versus €21.82.
- The source-checked garden test covers 63 Dublin homes. It adds no supported improvement and remains exploratory.
- The contribution is a reproducible comparison with explicit coverage and uncertainty. Timing, provider identity and extraction quality bound the claims.

## Reproduction and files

From the repository root in PowerShell, using Python 3.14:

```powershell
cd Research/october-price-benchmark
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python benchmark.py
.venv/Scripts/python exploratory.py
```

The scripts resolve input paths from their own location. They automatically verify and unpack inputs.zip, which includes the original content-addressed sources, v2 JSONs and manifests. No external project data directory is required. requirements.txt freezes the executed environment. model-results.csv stores full precision, uncertainty and selected penalties. model-predictions.csv stores outer predictions and folds. feature-audit.csv records eligibility and provenance. evidence-checks.csv records each tested quotation and page match. input-hashes.csv fixes the local manifest and extraction inputs. model-comparison.png is the presentation chart. README.md retains the original geographic study.
