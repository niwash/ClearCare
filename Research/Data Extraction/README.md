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

- The three flags are `true` when the report mentions the amenity and `null`
  when it does not. `null` does not mean the home has none.
- The lists keep the report's own wording. They are not normalised yet, so
  "physio" and "physiotherapy" are different values.
- `sha256` names the exact PDF the amenities were read from. It is the same
  hash the database stores for a report, so these files can be loaded into
  the database later.

## Not done yet

- Loading the results into the database and serving them through the API. That is a separate pull request: `load_amenities` reads the files this script writes, matching each to a stored report by `sha256`.
- Normalising the list values.
- Measuring accuracy. The plan is to hand-check 40 to 50 homes against the
  reports and report precision, recall and F1 for each field.
- Sending only the "About the designated centre" paragraph instead of the
  whole report. It would be cheaper and may be more accurate, and the
  pipeline's parser already finds that section.
- Reports that are scanned images with no text are skipped and logged.
- GPT-4o-mini is due to be retired from OpenAI's API in January 2027, so the
  model will need to change before the project's end date matters.
