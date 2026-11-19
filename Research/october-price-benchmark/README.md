# October 2026 Fair Deal price benchmark

Across 411 private and voluntary nursing homes, a county median with a sparse-county fallback reduced mean absolute error by €6.03 per week (22.8%) relative to the Dublin/outside-Dublin median. Each centre was held out once, with equal weight. The outcome is the maximum agreed weekly contract price printed in HSE Section 40 list 231, dated 14 October 2026. Individual residents' payments are outside the scope of this estimate. [HSE list](https://www.hse.ie/documents/3223/HSE_Section40_List_231_Published_List_14.10.2026.pdf)

| Training median used to estimate held-out rate | Homes scored | Mean absolute error (€/week) | Error reduction vs Dublin/outside (€/week, 95% paired interval) |
|---|---:|---:|---:|
| National | 411/411 | 49.47 | −23.04 (−27.31 to −18.87) |
| Dublin/outside Dublin | 411/411 | 26.43 | Reference |
| County with regional fallback | 411/411 | 20.40 | 6.03 (4.18 to 7.94) |

The source contains 411 distinct HIQA IDs. Weekly rates range from €1,200 to €1,508, with a median of €1,290. The 86 Dublin homes average €1,415.85 and the 325 elsewhere average €1,288.82. County comes from the HSE section heading, carried across page breaks.

The county rule requires five other homes in the same county before taking their median. Five was a study choice, fixed before scoring. In 389 folds the county qualified. The other 22 used the outside-Dublin median: Carlow (5), Laois (3), Leitrim (2), Longford (3), Monaghan (4) and Offaly (5). Each comparator excludes the held-out home from every median.

## Capacity linkage

The archived HIQA older persons register was fetched and last modified on 26 October 2026. All 411 price IDs match exactly once and have positive maximum occupancy. There are zero unmatched IDs, ambiguous IDs or missing values. Zero of the 411 capacities in this snapshot have verified provenance by the 14 October cutoff. A registration start date does not establish when the recorded occupancy took effect. The HSE file itself was fetched on 26 October and last modified on 23 October, so the cutoff uses its printed list date. A targeted search did not locate a downloadable national October register frozen by the cutoff. Historical individual registrations were not reconstructed. The authorised exploratory capacity comparison uses this snapshot with its 12-day timing mismatch, as documented in findings.md. [HIQA register export](https://www.hiqa.ie/centre/export/older_persons_register.csv?_format=csv)

## Uncertainty and interpretation

The reported errors are exact for this edition. The intervals describe sensitivity to the mix of homes: 10,000 paired bootstrap resamples of the 411 fixed held-out error differences, percentile endpoints, seed 20261117. They condition on the fitted medians and treat homes as independent. Related providers and counties can share pricing patterns. The exercise tests interpolation within one edition. Future rates and performance on entirely unseen providers require separate evaluation.

## Reproduction

From the repository root (the directory containing Research), using Python 3.14 in PowerShell:

```powershell
cd Research/october-price-benchmark
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python benchmark.py
.venv/Scripts/python exploratory.py
```

The script uses the pinned PyMuPDF version and the standard library, verifies the SHA-256 of both original inputs in the bundled inputs.zip archive, prints the summary and writes held-out.csv beside the script. That file contains one row per home, its observed rate, three out-of-sample predictions, fallback decision and register linkage status. Frozen input metadata are in inputs/data/manifests/price-lists.jsonl and inputs/data/manifests/register-snapshots.jsonl.


## Frozen input bundle

inputs.zip includes all 103 original v2 extraction JSON files, their source PDFs, the price PDF, register CSV and three source manifests. inputs.sha256 verifies the ZIP; its manifest.json verifies every member. prepare_inputs.py checks and unpacks it automatically into ignored inputs/. Existing modified inputs fail verification. No project data directory, API credentials or network access is needed after installing dependencies. input-hashes.csv preserves the original extraction/manifests inventory; raw object filenames are SHA-256 hashes. Both analysis scripts verify source bytes. Source dates and the capacity timing mismatch remain as described above.
