# Amenities: what they are, what we found, and how to run it

## What this is

HIQA's inspection reports describe each nursing home in the provider's own words ("About the designated centre") and in the inspectors' observations. This work reads those reports and pulls out nine facts about what a home offers its residents, so the site can compare homes:

| Field | Type | Meaning |
| --- | --- | --- |
| care_types | list | Kinds of care, such as long-term residential, dementia care, respite care |
| room_types | list | Single room, twin room, en-suite and so on |
| has_outdoor_space | true or null | The report mentions a garden, courtyard or outdoor space |
| activities | list | Activities, therapies and programmes the report mentions |
| has_transport | true or null | The report mentions transport the centre provides for residents, such as its own bus. Public transport nearby does not count |
| has_chapel_or_religious_services | true or null | The report mentions a chapel, oratory or religious services |
| special_units | list | Specialist units, such as a memory care unit |
| dining_notes | text | What the report says about dining |
| other_notes | text | Other notable facilities |

A flag is `true` when the report mentions the amenity and `null` when it does not. `null` does not mean the home has none. The lists keep the report's own wording and are not normalised yet, so "physio" and "physiotherapy" are different values.

The reading is done by GPT-4o-mini. A model can miss things or add things, so these values are what the report appears to say, not checked facts. See [Accuracy](#accuracy).

## How it fits together

```
HIQA website
   |  pipeline: reports download (weekly, ADR-0014)
   v
data/raw/sha256/...   data/manifests/inspection-reports.jsonl
   |                     |
   |   Research/Data Extraction/extractor.py  (GPT-4o-mini)
   |                     v
   |            data/amenities/<centre_id>.json
   |                     |
   |   pipeline: load_amenities
   v                     v
 pipeline: extract_about        clearcare.report_amenities  (db/V11)
 (stores the About section              |
  as report text, about-v1)             v
   |                            view clearcare.centre_amenities
   v                                    |
clearcare.inspection_report_text        v
                              API: GET /centres/{centre_id}/amenities
```

- The extractor is a standalone script. It downloads nothing. It uses the reports the pipeline has already stored.
- `extract_about` is part of the pipeline's schedule and runs right after `extract_text`. Nothing reads its rows yet. They are kept so that a later version can send only the About section to the model.
- The API serves the newest extraction of each centre's newest report that has one.

Design reasons are in [ADR-0019](adr/0019-amenities-read-from-reports.md).

## What we found while building it

- The first version of the extractor cut each report to its first 12,000 characters. Reports run from about 19,000 to 49,000 characters, and gardens and activities are described later on. Some homes were missed (for example centres 7785 and 7793), and 13 homes came back with no outdoor space value. The current extractor sends the whole report. The longest Dublin report is about 12,000 tokens, well inside GPT-4o-mini's context.
- The three flags came back as only true or null in the 103 Dublin results. The prompt describes when to say true, and the model leaves the rest empty, so false does not appear in practice. The database stores whatever the extractor wrote.
- `has_transport` first came back true for centre 5 (Annabeg) only because its report says the centre is served by the Luas, DART and local buses. The field description and the system prompt now say that public transport nearby does not count, and centre 5 comes back null. None of the homes checked so far has transport of its own, so a true result has not been seen since the change.
- The "About the designated centre" section is the main source for care types, room types and special units. The pipeline's report text left it out on purpose (ADR-0016), which is why `extract_about` exists.
- An earlier Dublin run (103 homes, on the first 12,000 characters) cost about 6 cents. Those results are loaded as `amenities-v0` and are replaced by later runs, because the API serves the newest.
- Of the 103 Dublin PDFs in that earlier run, 97 matched the database's latest report for their centre by hash. Centres 7, 22, 183, 5590 and 5880 have a newer report in the database, and centre 5307 had a newer one locally.
- GPT-4o-mini is due to leave OpenAI's API on 14 January 2027. Changing the model is a later plan.

## How to run it

You need the repository, Docker, Python 3.11 or newer, and an OpenAI key.

1. **Start the database and apply the migrations.**

   ```sh
   docker compose up migrate
   ```

   Starts PostgreSQL and applies everything in `db/`, including `V11__report_amenities.sql`. See CONTRIBUTING.md for the `.env` file.

2. **Download the reports.** Set `CLEARCARE_CRAWL` in `.env` to a county name or `all`, then:

   ```sh
   docker compose up -d pipeline
   ```

   The pipeline downloads reports weekly, loads them, extracts their text and, with `extract_about`, their About section. Follow it with `docker compose logs -f pipeline`. Reports are stored in `data/raw/` and listed in `data/manifests/inspection-reports.jsonl`.

3. **Run the extractor.** Put `OPENAI_API_KEY=` and your key in `.env`, install the packages listed in `Research/Data Extraction/README.md`, then from the repository root:

   ```sh
   python "Research/Data Extraction/extractor.py" --dry-run --limit 5
   python "Research/Data Extraction/extractor.py" --limit 5
   ```

   The first command lists which report it would read for 5 homes and calls nothing. The second extracts those 5 homes into `data/amenities/`. Drop `--limit` to do every home.

4. **Load the results into the database.**

   ```sh
   docker compose run --rm --build pipeline clearcare_pipeline.load_amenities --input /data/amenities
   ```

   `--build` rebuilds the pipeline image first. Without it, an image built before this change is reused and fails with `No module named clearcare_pipeline.load_amenities`. Reads every file in `data/amenities`, matches each to a stored report by the hash of its PDF, and inserts it. Running it twice adds nothing. Files whose PDF is not in the database are counted as unmatched and logged.

5. **Ask the API.**

   ```sh
   docker compose up -d --build api
   curl http://127.0.0.1:8080/centres/1/amenities
   ```

   `--build` makes sure the running API has the new endpoint. Returns the amenities for centre 1, or `"amenities": null` if there are none yet. A centre that is not in the register gives a 404. The response is described in `api/openapi.yaml`.

Loading older results from a single file: `--input` also takes a JSON file holding a list of records. `make_amenities_input.py` builds one from the 103 Dublin results of the first run (see its docstring).

## Accuracy

The values have not been measured yet. The plan is a hand-labelled gold set. A person reads the report and writes down what the nine fields should be, without looking at the model's answer. Each field of each home is then counted as a match, a false negative (the model missed something that is in the report) or a false positive (the model added something that is not). From those counts we report precision, recall and F1, per field and overall. The first gold set is 18 Dublin homes, chosen to vary provider, naming and report history. After that it grows and extends to other counties.

## Where the code is

| What | Where |
| --- | --- |
| Extractor | `Research/Data Extraction/extractor.py` |
| Migration (table, view, `about` kind) | `db/V11__report_amenities.sql` |
| About section cut and step | `pipeline/src/clearcare_pipeline/parser/about.py`, `extract_about.py` |
| Loader | `pipeline/src/clearcare_pipeline/load_amenities.py` |
| Schedule | `pipeline/src/clearcare_pipeline/schedule/__main__.py` |
| API | `api/src/main/java/ie/clearcare/api/amenities/`, `api/openapi.yaml` |
| Decision record | `docs/adr/0019-amenities-read-from-reports.md` |

## Version labels

| Label | Meaning |
| --- | --- |
| `text-v1` | The pipeline's report text (ADR-0016). Unchanged by this work. |
| `about-v1` | The About section, stored as report text of kind `about`. |
| `amenities-v0` | The first extraction: first 12,000 characters of the PDF. |
| `amenities-v1` | The current extractor: the whole report. |

## Troubleshooting

- **Flyway says "checksum mismatch" for a migration.** Your database was restored from a dump made with a different copy of that migration. For a local copy you only use for testing, `docker compose run --rm migrate repair` updates the stored checksum, then run `docker compose run --rm migrate` again.
- **Port 5432 is not available.** Another PostgreSQL uses it. Set `CLEARCARE_DB_PORT` in `.env`, for example 15432.
- **The extractor says a PDF is not in the raw store.** The pipeline has not downloaded that report on this machine. Run step 2 and let it finish.
- **The loader reports unmatched records.** The file was read from a PDF whose hash is not in the database, usually because HIQA has published a newer report since. Run the extractor again for that home.
- **Some homes have no text from `extract_text`.** Their PDFs are missing from `data/raw/`. The log names each report.
