# Amenities

The API serves report-derived amenities with their report ID, inspection date,
extractor version and model. The values are model output, not established fact.
Human gold-set evaluation remains separate. Design: [ADR-0021](adr/0021-amenities-read-from-reports.md).

## API versions

- `GET /centres/{centre_id}/amenities` keeps the v1 response. Explicit
  `?version=amenities-v1` does the same, including stored v0/v1 results.
- `GET /centres/{centre_id}/amenities?version=amenities-v2` returns four lists:
  care_types, room_types, activities and facilities. Each entry has an exact
  approved item and evidence objects with quote, page_start and page_end.
- Both use the existing centre_id/amenities envelope and report metadata.
  A centre with no data for the requested version returns amenities: null,
  without falling back to another version. An unknown centre gives 404;
  an unpublished register gives 503. An unsupported version gives 400.
- V2 omission means not confirmed, not absent. Page numbers include the cover
  and blank pages. Structural validation does not verify quote truth.
- Legacy flags remain true/false/null according to what the report states.
  Null does not mean absence. The default v1 fields are unchanged.

## Scheduled extraction

The scheduler runs `clearcare_pipeline.amenities` after report ingestion, text
extraction and commitment splitting, both at startup and after a reports crawl.
It is off unless `CLEARCARE_AMENITIES=on`. On AWS, `amenities_enabled` defaults
to false; enabling it and deploying the task is a separate rollout step.
The stage uses the task's existing `ANTHROPIC_API_KEY` secret.

To inspect work without a model call or database write:

```sh
python -m clearcare_pipeline.amenities --data-dir ./data --dry-run
```

For an authorized local run, set `CLEARCARE_AMENITIES=on` and run the same
command without `--dry-run`. The default limit is 20 reports per invocation;
use `--limit` to change it. Startup and a due reports crawl can each invoke it.
The stage stops after three consecutive extraction failures. SDK requests use
60-second timeouts and at most two SDK retries; the existing single retry for
invalid structured output is retained.

Selection uses each centre's latest parsed database report, then skips reports
already loaded at amenities-v2. It never chooses an older report just because
that report lacks amenities. No key or model client is needed when no work is
pending. Undated sources are logged and skipped.

Local outputs use `scheduled-amenities/amenities-v2/` under the data directory,
separate from manual outputs. With bucket settings configured, successful files
are saved under `amenities/scheduled/amenities-v2/<centre>/<hash>.json` before
loading. A later task reuses that archive if a load failed. The existing task
role already permits reads and writes in the raw bucket; bucket versioning
retains history. Corrupt or mismatched archive files fail visibly and are not
overwritten. In local runs without a bucket, keep the data directory between
retries. Stopping a task before its archive write can require another model call.

Each successful report is loaded transactionally through the existing v2 loader.
Failures never write successful empty results or replace existing rows. Missing
or unreadable PDFs, model refusals, truncation and rate limits leave work pending.
Failures or deferred work return exit code 3, recorded by the scheduler as an
incomplete run; database, storage, key or configuration errors return 1 and fail
the run. Correct the cause and rerun; there is no need to delete stored results.

The shared extractor is packaged in `pipeline/src/clearcare_pipeline/amenities/`;
the research CLI uses it too. The prompt, model, PDF page numbering and evidence
rules are unchanged. Stored section text does not cover the full PDF, so the
amenities stage reads whole pages only for pending reports using the same
pdfplumber reader as the manual extractor. It does not copy the section parser
or add About-section storage. Production coverage checks and human evaluation
remain separate from scheduling.

## Extract and load

The pipeline must first ingest parsed reports into PostgreSQL and store the PDFs.
Configure standard libpq connection settings (PGHOST, PGPORT, PGDATABASE, PGUSER
and PGPASSWORD or a password file) for the extractor. Database selection uses
inspection date descending, nulls last, then report ID ascending. Undated-only
centres are logged and skipped because v2 requires a source inspection date.
Use --report-source manifest explicitly for offline manifest-based extraction.
Set ANTHROPIC_API_KEY in the environment or root .env; install extractor dependencies
from Research/Data Extraction/README.md. From the repository root:

```sh
python "Research/Data Extraction/extractor.py" --dry-run --limit 5
python "Research/Data Extraction/extractor.py" --limit 5
docker compose run --rm --build pipeline clearcare_pipeline.load_amenities --input /data/amenities/amenities-v2 --data-dir /data
```

The dry run makes no model call; the second command is paid extraction.
Before writing a file, the extractor checks each quote against the report text
(Research/Data Extraction/README.md, "Evidence check").
V2 files live under data/amenities/amenities-v2/<centre_id>/<sha256>.json,
preserving v1 files and distinct reports. The loader accepts recursive directories
or one JSON list file. V2 loads need the exact original PDF in the raw store for
hash/page-bound checks and must match stored centre and PDF hash uniquely.
A differing inspection date is logged, rather than blocking an exact source
match. Original output files are retained; the API date comes from the matched
database report. Ambiguous matches fail the transaction instead of choosing
arbitrarily.
The entire load is transactional. Existing report/version rows are never replaced.

The extractor version names the prompt and the schema, not the model, so a run
with another model writes the same file paths and the same (report_id,
extractor_version) rows. To replace one model's results with another's, extract
with `--force`, which rewrites the output files, and load into a database that
has no amenities-v2 rows for those reports: the loader keeps existing rows, so
an administrator deletes the rows to replace first, for example
`DELETE FROM clearcare.report_amenities_v2 WHERE model LIKE 'gpt-%'`. The model
column on every row says which run it came from.

V2 files require a timezone-aware UTC extracted_at value. The legacy loader
keeps its existing optional timestamp and load-time fallback for files without
one. Existing database rows remain untouched.

Apply migrations through the normal Flyway process before loading v2. V12 adds
a separate v2 table and read-only API view; V11 and existing data are not reset.
Rebuild the API after code changes, then request v2 explicitly:

```sh
curl 'http://127.0.0.1:8080/centres/1/amenities?version=amenities-v2'
```

Both views choose the newest inspection report with matching data, with report
ID ascending for equal dates, then extraction time descending and insertion ID
descending. Version labels do not determine recency. A changed prompt or schema
requires a new extractor version; the model is recorded on every row. V0 was
truncated text, v1 was whole-report free lists/flags, and v2 uses the approved 93
categories and item-level evidence.

Unmatched inputs are reported and skipped; correct source identities and ingestion
before retrying rather than attaching evidence to another report.
