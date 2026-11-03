# Amenities v2 extractor

Reads each centre's latest stored HIQA inspection report using GPT-4o-mini.
It downloads nothing and does not load the database or run on a schedule.
CCARE-195 tracks v2 implementation; CCARE-171 tracks scheduling.

## Contract

`amenities-v2.schema.json` is the frozen approved extraction-file contract.
`amenities_v2.py` enforces its exact categories and keys plus structural checks
that JSON Schema cannot express. There are four required arrays: care_types
(18 choices), room_types (6), activities (35) and facilities (34).
Each selected category has `item` and non-empty `evidence`, containing exact
`quote`, integer `page_start` and integer `page_end`. Empty lists mean no
confirmed items in a successfully processed report, never a processing failure.

The prompt includes the approved category boundaries. It requires direct
support for current provision and excludes future compliance-plan promises.
PDF page markers count from 1 including the cover and blank pages. Structural
checks reject unknown categories/keys, duplicate items, blank quotes, missing
evidence, non-integer pages and invalid ranges. Exact duplicate evidence is
removed; distinct passages and restrictions remain. Categories use checklist
order. Quote-content verification and human evaluation remain separate work.

## Setup and run

Use Python 3.11 or newer, with the existing extractor dependencies:

```sh
pip install pdfplumber==0.11.10 openai==3.37.0 pydantic==2.14.1 python-dotenv==1.2.4
```

Set `OPENAI_API_KEY` in the environment or root `.env`. From the repository root:

```sh
python "Research/Data Extraction/extractor.py" --dry-run
python "Research/Data Extraction/extractor.py" --centre-id 13
```

Input is `<data-dir>/manifests/inspection-reports.jsonl` and PDFs under
`<data-dir>/raw/sha256/<first two hash characters>/<hash>`. The data directory
defaults to `CLEARCARE_DATA_DIR` or `./data`. The stored PDF hash is checked
before sending text to the model. Metadata must exist and be valid; none is
invented. The requested model remains GPT-4o-mini; output records the model
identifier returned by the API and a UTC extraction timestamp.

Options remain `--data-dir`, `--output-dir`, repeatable `--centre-id`,
`--centres-file`, `--limit`, `--force` and `--dry-run`. Dry-run makes no model
calls. Try a small explicit limit before a paid batch. Output allowance is
16,000 tokens for quote-bearing results. Reports over 200,000 characters fail
instead of being truncated. Unreadable PDFs, refusals, incomplete responses and
invalid output fail without overwriting good results. Any failed centre gives
an exit status of 1 so an operator can detect partial runs.

## Output and retained history

Files now use `<output-dir>/amenities-v2/<centre_id>/<sha256>.json`.
The output directory defaults to `<data-dir>/amenities`. Existing v1 files at
`<output-dir>/<centre_id>.json` remain untouched. Different PDF hashes have
separate files. A valid v2 file for the same centre and hash is skipped;
`--force` atomically replaces that file only after successful extraction.
Prompt/model/schema changes after this version is frozen require a new version.

The outer keys remain `centre_id`, `inspection_date`, `file_name`, `hiqa_url`,
`sha256`, `model`, `extractor_version`, `extracted_at` and `amenities`.
Source metadata comes from the manifest, never the model. The model returns
only the `amenities` wrapper.

## Integration status

The current loader, database and HTTP endpoint support v1 only. Do not send
these v2 item objects to the v1 loader. Lossless evidence storage, API
compatibility and migration work are the next focused part of CCARE-195.
The HTTP envelope is not changed by this extractor patch. Scheduling remains
CCARE-171. Human labels and evaluation remain Waseel's CCARE-192/193 work;
these tests establish implementation behaviour, not model accuracy.

## Offline checks

No API key, model calls, Docker or human gold labels are required:

```sh
python -m unittest discover -s "Research/Data Extraction" -p "test_extractor.py" -v
```

The tests need Pydantic and python-dotenv. They check the frozen category
contract, evidence validation, page numbering, model failures, provenance,
version-aware caching and preservation of good files after failures.

## Historical v1 findings

- The first version cut each report to 12,000 characters and missed gardens
  and activities described later on. Some homes were missed (for example
  centres 7785 and 7793), and 13 homes came back with no outdoor space value.
- The three flags came back as only true or null in the 103 Dublin results.
  The prompt describes when to say true, and the model leaves the rest empty,
  so false has not appeared yet.
- `has_transport` first came back true for centre 5 (Annabeg) only because
  its report says the centre is served by the Luas, DART and local buses. The
  field description and the system prompt now say that public transport
  nearby does not count, and centre 5 comes back null.
- The earlier Dublin run (103 homes, on the first 12,000 characters) cost
  about 6 cents. Those results are loaded as `amenities-v0` and give way to
  later runs, because the API serves the newest.
- Of the 103 Dublin PDFs in that run, 97 matched the database's latest report
  for their centre by hash. Centres 7, 22, 183, 5590 and 5880 have a newer
  report in the database, and centre 5307 had a newer one locally.
