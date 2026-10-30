# Amenities

What each nursing home offers its residents, read from its HIQA inspection reports and served at `GET /centres/{centre_id}/amenities`. Design reasons are in [ADR-0019](adr/0019-amenities-read-from-reports.md). Findings and the accuracy plan are in `Research/Data Extraction/README.md`.

## What the fields mean

The values are what a model (gpt-4o-mini) read from the whole report text, stored with the report they came from. Provider text and inspector observations are not separated yet, and the values have not been checked against a gold set.

- `care_types`, `room_types`, `activities`, `special_units`: lists of what the report names, such as dementia care, en-suite rooms or a memory care unit. They are not normalised yet, so "physio" and "physiotherapy" are different values.
- `has_outdoor_space`, `has_transport`, `has_chapel_or_religious_services`: true or false when the report says so, null when it is silent. Null does not mean the home has none. Transport counts only when the centre itself provides it for residents; public transport nearby does not.
- `dining_notes`, `other_notes`: free text, empty when the report says nothing.

Nothing on the VM fills the table yet. The extractor is not in the pipeline image and needs an OpenAI key, so the endpoint answers `"amenities": null` for every centre until the steps below are run by hand.

## How to run it

The pipeline must have downloaded the reports first, so that `data/raw/` and `data/manifests/inspection-reports.jsonl` exist.

1. **Run the extractor.** Put `OPENAI_API_KEY=` and your key in `.env` and install the packages listed in `Research/Data Extraction/README.md`. From the repository root:

   ```sh
   python "Research/Data Extraction/extractor.py" --dry-run --limit 5
   python "Research/Data Extraction/extractor.py" --limit 5
   ```

   The first command lists which report it would read for 5 homes and calls nothing. The second writes those 5 homes to `data/amenities/`. Drop `--limit` to do every home.

2. **Load the results.**

   ```sh
   docker compose run --rm --build pipeline clearcare_pipeline.load_amenities --input /data/amenities
   ```

   `--build` makes sure the image has the loader. Each file is matched to a stored report by the hash of its PDF. Running it twice adds nothing. `--input` also takes one JSON file holding a list of records.

3. **Ask the API.**

   ```sh
   docker compose up -d --build api
   curl http://127.0.0.1:8080/centres/1/amenities
   ```

## Version labels

| Label | Meaning |
| --- | --- |
| `amenities-v0` | The first extraction: the first 12,000 characters of each PDF. |
| `amenities-v1` | The current extractor: the whole report. |

Rows are append-only. Re-running at the same version adds nothing, so a changed prompt or model needs a new `extractor_version`. The API serves the newest extraction of each centre's newest report.

## Troubleshooting

- **The loader reports unmatched records.** The file was read from a PDF whose hash is not in the database, usually because HIQA has published a newer report since, or the pipeline on this machine has not stored that report. Run the extractor again for that home, after the pipeline has downloaded its latest report.
