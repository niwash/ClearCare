# Next-inspection regulation study, 17 November 2026

The completed presentation findings, expanded source audit and slide-ready points are in [presentation-findings.md](presentation-findings.md). The original four-PDF checks below remain documented as the initial sample. The expanded sample totals 12 PDFs at six homes.

## Denominators

[The denominator table](denominators.csv) has one row for each of 32 exported regulation identifiers. Each starting observation is one loaded report judging one regulation. The four home columns count distinct centres at the starting, follow-up, reassessment and later Not compliant stages. Home counts overlap across regulation rows.

Across 2,019 loaded reports, 1,484 starting reports had paired judgements. Of 27,473 starting judgements, 20,735 had a later report, and 6,738 had no later loaded report. Of the 20,735, the next report omitted the regulation in 8,372 cases and judged it again in 12,363 (59.6%). Among those rechecked, 7,019 were Compliant, 3,362 Substantially compliant and 1,982 Not compliant (16.0%). The recorded Not compliant fraction across all follow-ups was 9.6%. The outcome of an omitted regulation is unknown.

## Sources and reproduction

The study follows [ADR-0015](../../docs/adr/0015-re-assessment-view.md) and the inspection section of [the full research report](../Research%20Questions/ClearCare%20inspection%20research%20report.md). The 9 November public centre-report inventory covers the 8 November register of 547 homes. Public report details and the [view-backed matrix](https://api.clearcare.ie/statistics/re-assessment) were checked on 17 November. Latest loaded inspection was 19 August 2026. This is a read-window export. It represents loaded reports and can pass over thematic or otherwise unloaded visits.

From the repository root (the directory containing Research), using Python 3.14 in PowerShell:

```powershell
cd Research/solo-reassessment
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python build.py
.venv/Scripts/python audit_sources.py
.venv/Scripts/python charts.py
```

The script reads snapshot.zip beside it and reproduces the table offline using the Python standard library. The archive preserves 2,019 report responses, the saved centre listings, the matrix and a manifest of SHA-256 checksums. snapshot.sha256 verifies the archive before processing. The manifest records preservation time and cache modification times. Original detail retrieval is known to have occurred on 17 November, but exact per-response retrieval times were not recorded. The matrix was fetched again during preservation and reconciled successfully. Cache modification times do not establish API response times.

The script checks every preserved input checksum, unique report IDs, centres, dates, the inventory count and all 15 starting-by-next-result matrix cells. The paired-row SHA-256 remains ad8d3ac5465219b854a3efc96bf1bf0f3997648448d0ed5a70910f2d7862bfdd.

Pairing stops at the earliest later loaded date for the same centre. Undated reports cannot enter either side. A tie on the next date excludes the starting report. Repeated regulation identifiers within a report use the first exported entry. Matrix agreement verifies aggregate reconciliation. The PDF checks below address source accuracy separately.

## PDF checks

Convenience sample of two adjacent report pairs, four of 2,019 loaded reports. Checked all four Appendix 1 lists in both directions against exported identifiers and judgements. Source bytes matched the API SHA-256 for each report. These are document checks, with no independent second reviewer or verification of the complete HIQA inspection timeline.

- Aclare House, centre 1. All 10 earlier and 10 later Appendix 1 judgements matched. Three earlier regulations were rechecked. Regulation 17 moved from Substantially compliant to Not compliant, 23 remained Substantially compliant and 28 moved from Not compliant to Substantially compliant. Seven were omitted. [26 February 2025, p. 15](https://www.hiqa.ie/system/files/inspectionreports/1-aclare-house-nursing-home-26-february-2025.pdf) and [15 January 2026, p. 13](https://www.hiqa.ie/system/files/inspectionreports/0001-aclare-house-nursing-home-15-january-2026.pdf).
- The Marlay, centre 108. All 15 earlier judgements and 15 of 16 later Appendix entries matched. Nine earlier regulations were rechecked and six omitted. The later PDF also lists Registration Regulation 4, Compliant, absent from the export. It has a different legal identifier from Regulation 4 on written policies. It does not change this pair's nine rechecks because the earlier report did not assess it. It does remove one starting observation from the latest report. [10 March 2025, p. 15](https://www.hiqa.ie/system/files/inspectionreports/108-the-marlay-nursing-home-10-march-2025.pdf) and [14 January 2026, p. 17](https://www.hiqa.ie/system/files/inspectionreports/108-the-marlay-nursing-home-14-january-2026.pdf).

Across these selected PDFs all 50 exported entries were present with matching judgements, and 50 of 51 printed entries appeared in the export. The two later reports were each the latest loaded for their home. Their 25 exported judgements therefore enter the no-later-report denominator when used as starting observations. The sample cannot establish national extraction accuracy or the frequency of missed registration regulations.

## Prediction feasibility

The counts support investigating a pooled retrospective benchmark for the conditional outcome of Not compliant when the same regulation is next rechecked. Using later inspection dates from 1 January through 19 August 2026 as a potential evaluation period gives 3,362 rechecks at 392 homes, with 520 Not compliant outcomes at 164 homes. Counts vary sharply by regulation. Governance and management (23) supplied 144 of those events, while eight of the 32 identifiers supplied none. A separate forecast for every regulation is unsupported.

Selection matters. Recheck coverage was 46.7% after Compliant, 75.6% after Substantially compliant and 88.4% after Not compliant. The study cannot infer the unobserved outcomes of regulations inspectors omitted. Repeated observations within homes also reduce independent information. Any later benchmark would require verified publication-time availability, chronological evaluation and centre-level uncertainty, together with broader source checks across templates and legal identifiers. These counts establish sample availability only. Predictive performance and calibration remain unmeasured.

## Study discussion

The denominator results show that a large loaded national dataset can support a descriptive account of what happened at the next eligible inspection. They also show that the observation process depends on the earlier judgement. Nearly nine in ten earlier Not compliant judgements were assessed again, compared with fewer than half of earlier Compliant judgements. Consequently, the observed later judgement distribution applies to the subset selected for reassessment.

The four-document check provides limited evidence that exported judgements reproduce the printed Appendix 1 findings in the selected reports. Its missing registration judgement demonstrates that reconciliation with the API cannot establish complete source coverage. Since source accuracy was checked at only two homes, this study leaves national error rates, historical template differences and the coverage of registration regulations unresolved.

The proposed 2026 evaluation period was chosen during this feasibility analysis to count available later outcomes. It is an exploratory period. A future analysis would need to specify its forecast origin, outcome, evaluation design and publication timing before fitting. The 520 events are repeated regulation observations across 164 homes, so treating them as independent would overstate information. The uneven regulation counts also constrain any claims about performance for individual regulations.

The completed deliverable is therefore a reproducible descriptive denominator study and an evidence-based assessment of modelling feasibility. Aggregate sample availability supports further investigation of a pooled benchmark. Predictive usefulness requires additional source validation and a prospective analysis specification.


## Included audit evidence

audit-pdfs/ preserves all 12 source PDFs. audit_sources.py verifies their hashes against snapshot.zip and regenerates audit-evidence.json for all 12. audit-results.csv records the eight additional checks; the original four checks are documented above. The saved audit judgements are review records, not automatically regenerated labels. With the preserved PDFs, all three scripts run offline after dependency installation. If a PDF is removed, the audit script attempts its original official URL and still requires the archived checksum.
