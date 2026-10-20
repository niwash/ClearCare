# CCARE-113 label sheets

Five report pairs cover 43 findings. Each sheet starts with 43 rows.
A finding is a judgment of Substantially compliant (SC) or Not compliant (NC); Compliant is not a finding.
Only care regulations are included.

## Pair selection

`candidates.csv` freezes all 399 Dublin standard reports used on 18 October 2026, including reports with no findings.
Here, standard means a regulation inspection; the 28 unsupported layouts are outside this cohort.
Each row identifies the centre, report, inspection first day, source SHA-256 and HIQA PDF URL.
`sc_nc_findings` supplies the eligibility count; `report_id` preserves the local key used in `pairs.csv`.
Centre and Fieldwork IDs identify the public records. URLs came from the database's `source_file.url`.

Apply this rule to `candidates.csv`, comparing hashes and IDs as text:

1. Order each centre's reports by `inspection_date`, `fieldwork_id`, then `sha256`, ascending. This cohort has no same-day ties.
2. A finding report qualifies when `sc_nc_findings` is positive and at least two reports have later inspection dates. Pair it with the immediately next report. `later_reports_available` includes that partner.
3. Sort qualifying reports by `sha256`, `centre_id`, then `fieldwork_id`, ascending. There are 191 qualifying reports from 96 centres, covering 2023–2026.
4. Scan once, selecting only reports whose centre and finding year have not been selected. Stop at five.
5. If needed, scan again and take reports from unselected centres until there are five. Keep selection order for pair IDs.

This selects four finding years, then fills the fifth place. Sheet rows use ascending regulation number.
Run `python3 Research/labels/select_pairs.py` from the repository root to print `pairs.csv` exactly.
The script reads only `candidates.csv`, needs no database or extra packages, and changes no files.
The SHA-256 of the sorted report hashes, each followed by a newline, is `a33bb88002ab8d7274d16dc430219ffa28ffee34df912979b9264daa9a597d15`.

## Labelling conventions

PDF pages count from 1, including the cover; ranges include both ends. Number commitments from 1 within each finding. Blank label fields mean unlabelled unless an exception below applies. Enter total active minutes once per pair per sheet, on its first row; exclude breaks. Use anonymous labeller codes.

Sheet 1 scores CCARE-112 commitments. A commitment is one action the provider states in its response, with its stated deadline.
Read the whole Section 1 response and copy commitment text verbatim. Duplicate its starter row for each additional commitment, keeping the pre-filled values.
Record the stated deadline in the provider's words and its page; leave both blank if none is stated. Never substitute Section 2's compliance date.
If no commitment is stated, keep the starter row with blank commitment fields. Response pages come from extractor `CCARE-111-review`.

Sheet 2 is for CCARE-114. Keep one row per finding and label the two axes separately.
`re_assessment` allows exactly `not re-assessed`, `improved`, `unchanged`, or `worsened`.
Use `not re-assessed` when the next report has no judgment for that regulation, and leave `next_judgment` blank.
Otherwise copy `Compliant`, `Substantially compliant`, or `Not compliant`, ordered from better to worse, and compare with the earlier judgment.
The first judgment again ends this re-assessment; if it is a finding, later following starts from it.
`reported_outcome` allows exactly `done`, `in progress`, `not done`, `unclear`, or `no statement found`.
The first three mean the glossary's `reported done`, `reported in progress`, and `reported not done`.

A follow-up statement must refer back to an earlier commitment, finding or compliance plan. Copy its evidence verbatim from the next report and give its PDF page(s).
`not done` requires the inspector's words; never infer it from a judgment. If statements give different outcomes for one finding, use `unclear` and quote them.
Use `no statement found` only after reading the next report; it does not mean the commitment was not done. Leave outcome evidence blank in that case, retaining any re-assessment evidence.
Identify separate evidence passages for the two axes when needed. Keep personal names out of label files and evidence quotes.

## Working copies and versions

Labellers work independently in separate copies, without seeing each other's labels or the stored commitment splits. Time each pair separately for each sheet.
Open reports through `finding_pdf` and `next_pdf` in `pairs.csv`; the full cohort's HIQA URLs are in `candidates.csv`.
Preserve the blank templates. Save labelled copies under distinct run and labeller names, recording the template commit and labelled-file version for each scoring run.
Never edit a file after a scoring run has used it. Corrections require a new version and a new run.
