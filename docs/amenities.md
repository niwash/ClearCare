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

## Extract and load

The pipeline must first store reports and its inspection-reports manifest.
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
hash/page-bound checks and must match stored centre, inspection date and PDF hash.
The entire load is transactional. Existing report/version rows are never replaced.

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
