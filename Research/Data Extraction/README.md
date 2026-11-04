# Amenities v2 extractor

Reads each centre's latest stored HIQA inspection report with Claude Haiku 5.5,
or with GPT-4o-mini when run with `--provider openai`.
It downloads nothing and does not load the database or run on a schedule.

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
order. Human evaluation remains separate work.

## Setup and run

Use Python 3.11 or newer, with the existing extractor dependencies:

```sh
pip install pdfplumber==0.11.10 anthropic==1.15.0 openai==3.37.0 pydantic==2.14.1 python-dotenv==1.2.4 "psycopg[binary]>=3.2"
```

Set `ANTHROPIC_API_KEY` in the environment or root `.env`, or `OPENAI_API_KEY`
for `--provider openai`. From the repository root:

```sh
python "Research/Data Extraction/extractor.py" --dry-run
python "Research/Data Extraction/extractor.py" --centre-id 13
python "Research/Data Extraction/extractor.py" --provider openai --centre-id 13
```

By default, input is the latest parsed database report per centre, ordered by
inspection date descending (nulls last), then report ID ascending. Configure
standard libpq PGHOST, PGPORT, PGDATABASE, PGUSER and password settings. Centres
with only undated reports are logged and skipped; v2 requires a date. Reports
that never ingested cannot displace a stored parsed report. Selection does not
require intro text, and an unreadable selected PDF still fails explicitly.
For the offline manifest catalogue use `--report-source manifest`. PDFs live under
`<data-dir>/raw/sha256/<first two hash characters>/<hash>`. The data directory
defaults to `CLEARCARE_DATA_DIR` or `./data`. The stored PDF hash is checked
before sending text to the model. Metadata must exist and be valid; none is
invented. Output records the model identifier returned by the API and a UTC
extraction timestamp.

Options include `--report-source` (`database` by default or `manifest`), `--provider` (`anthropic` or `openai`), `--data-dir`,
`--output-dir`, repeatable `--centre-id`, `--centres-file`, `--limit`,
`--force` and `--dry-run`. Dry-run makes no model calls. Try a small explicit
limit before a paid batch. Output allowance is 16,000 tokens for quote-bearing
results. Reports over 200,000 characters fail instead of being truncated. Unreadable PDFs, refusals, incomplete responses and
invalid output fail without overwriting good results. Any failed centre gives
an exit status of 1 so an operator can detect partial runs. A Claude reply
outside the contract, such as an item listed twice, is asked for once more
before the centre fails.

## Evidence check

Before writing a result, the extractor looks for each quote in the report's
page text. It searches the cited pages, then one page more on each side, then
the whole report, and sets the quote's pages to where it is found. A quote
cited past the last page is searched for the same way. Matching ignores case,
spacing, punctuation, ligatures and the page footer between two pages, so
"6 twin rooms, and 1" matches "6 twin rooms and 1". A digit next to either
end of a quote stops a match, so "2 single rooms" is not found in "12 single
rooms", but a letter that PDF extraction glued on ("bell. tResidents") does
not. A hyphen reads as a space, so "en-suite" matches "en suite". A word split
at a line end also matches whole: "gar-" followed by "den" on the next line
matches "garden". A quote found nowhere is dropped, and the log gives a
warning with the quote and its item. An item left without quotes is dropped
too. The log gives the counts for each home and for the run.

## Output and retained history

Files now use `<output-dir>/amenities-v2/<centre_id>/<sha256>.json`.
The output directory defaults to `<data-dir>/amenities`. Existing v1 files at
`<output-dir>/<centre_id>.json` remain untouched. Different PDF hashes have
separate files. A valid v2 file for the same centre and hash is skipped;
`--force` atomically replaces that file only after successful extraction.
Prompt or schema changes after this version is frozen require a new version.

The outer keys remain `centre_id`, `inspection_date`, `file_name`, `hiqa_url`,
`sha256`, `model`, `extractor_version`, `extracted_at` and `amenities`.
Source metadata comes from the selected database report and source URL (the
filename is its decoded final path component), or the explicit manifest source,
never the model. The model returns
only the `amenities` wrapper.

## Loading and API

The extractor and pipeline loader share the same v2 validation contract.
V12 stores item-level evidence, and the API exposes it through the explicit
version=amenities-v2 query while keeping the default v1 response.
See docs/amenities.md for loading requirements and API behaviour.
Human labels and evaluation remain independent of model outputs. Tests verify
implementation behaviour, not model accuracy.

## Offline checks

No API key, model calls, Docker or human gold labels are required:

```sh
python -m unittest discover -s "Research/Data Extraction" -p "test_extractor.py" -v
```

The tests need the Anthropic SDK, Pydantic and python-dotenv. They check the
frozen category contract, evidence validation, page numbering, model failures,
provenance, version-aware caching, the evidence check and preservation of good
files after failures.

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
