# Amenities extractor

Reads the latest HIQA inspection report of each nursing home and uses
GPT-4o-mini to pull out what the home offers its residents: care types, room
types, outdoor space, activities, transport, religious services, special units,
dining and other notes.

It does not download anything. The pipeline already stores every HIQA report
and a manifest of them in its data folder, and the extractor reads from there.

## Why it reads the whole report

The first version of this extractor cut each report to its first 12,000
characters. Reports run from about 19,000 to 49,000 characters, and gardens and
activities are described later on, so some homes came back with nothing for
them. This version sends the whole report. The longest Dublin report is about
12,000 tokens, well inside GPT-4o-mini's limit.

## Setup

1. Run the pipeline's report download at least once so the data folder has
   reports. See `CLEARCARE_CRAWL` in `.env.example` and
   `docs/adr/0014-pipeline-schedules-itself-in-compose.md` for how the scheduler works. The extractor needs:
   - `data/manifests/inspection-reports.jsonl`
   - `data/raw/sha256/...` (the stored PDFs)
2. Use Python 3.11 or newer. The pipeline uses 3.13, which is what this was
   tested with.
3. Install the packages:

   ```sh
   pip install pdfplumber==0.11.10 openai==3.37.0 pydantic==2.14.1 python-dotenv==1.2.4
   ```

4. Set your key in the root `.env` (copy it from `.env.example` if you do not
   have one):

   ```
   OPENAI_API_KEY=your-key-here
   ```

## Run

From the repository root, so the root `.env` is found:

```sh
python "Research/Data Extraction/extractor.py"
```

| Option | What it does |
| --- | --- |
| `--dry-run` | Lists the report that would be used for each home and stops. Costs nothing. |
| `--centre-id 13` | Only this home. Can be given more than once. |
| `--centres-file file.json` | Only the homes in a JSON file (a list of IDs, or of objects with a `centre_id`). |
| `--limit 10` | Stop after 10 homes. |
| `--force` | Extract again even if the output is up to date. |
| `--data-dir path` | The pipeline's data folder. Defaults to `CLEARCARE_DATA_DIR`, or `./data`. |
| `--output-dir path` | Where to write the files. Defaults to `<data-dir>/amenities`. |

A home is skipped when its output file already exists for the same report. If
HIQA has published a newer report since, that home is extracted again. A
failed home is reported at the end and tried again on the next run.

Each report is sent whole, up to about 12,000 tokens for the longest, so a
full run costs little (the earlier Dublin run on trimmed text cost about 6
cents). Try `--limit 5` first.

## Output

One file per home at `data/amenities/<centre_id>.json`:

```json
{
  "centre_id": "1",
  "inspection_date": "2026-01-15",
  "file_name": "0001-aclare-house-nursing-home-15-january-2026.pdf",
  "hiqa_url": "https://www.hiqa.ie/system/files/inspectionreports/...",
  "sha256": "220e8b82...",
  "model": "gpt-4o-mini",
  "extractor_version": "amenities-v1",
  "extracted_at": "2026-10-26T13:06:32+00:00",
  "amenities": {
    "care_types": ["respite care"],
    "room_types": ["single room", "twin room"],
    "has_outdoor_space": true,
    "activities": ["music therapy"],
    "has_transport": null,
    "has_chapel_or_religious_services": null,
    "special_units": [],
    "dining_notes": "",
    "other_notes": ""
  }
}
```

- The values are what the model read from the whole report text. Provider
  text and inspector observations are not separated yet.
- The three flags are `true` or `false` when the report says so and `null`
  when it is silent. `null` does not mean the home has none.
- The lists are not normalised yet, so "physio" and "physiotherapy" are
  different values.
- `sha256` names the exact PDF the amenities were read from. It is the same
  hash the database stores for a report.

## Loading into the database

`clearcare_pipeline.load_amenities` reads the files this script writes and
matches each to a stored report by `sha256`. The API then serves them at
`GET /centres/{centre_id}/amenities`. The commands are in `docs/amenities.md`.

## What we found while building it

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

## Accuracy

The values have not been measured yet. The plan is a hand-labelled gold set.
A person reads the report and writes down what the nine fields should be,
without looking at the model's answer. Each field of each home is then counted
as a match, a false negative (the model missed something that is in the
report) or a false positive (the model added something that is not). From
those counts we report precision, recall and F1, per field and overall. The
first gold set is 18 Dublin homes, chosen to vary provider, naming and report
history. After that it grows and extends to other counties.

## Not done yet

- Normalising the list values.
- Sending only the "About the designated centre" section instead of the
  whole report. It would be cheaper and may be more accurate.
- Reports that are scanned images with no text are skipped and logged.
- GPT-4o-mini is due to be retired from OpenAI's API in January 2027, so the
  model will need to change before the project's end date matters.
