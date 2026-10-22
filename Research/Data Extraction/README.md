# ClearCare — Amenities Extraction

This extracts structured amenities data from HIQA inspection report PDFs for Dublin nursing homes, using GPT-4o-mini. The output is a set of JSON files (one per nursing home) with amenities such as care types, room types, outdoor space, and activities pulled out of each report's free-text description.

## How it works

```
OCI Bucket (PDFs + index.csv)
        │
        ▼
  downloader.py          ← fetches the most recent report per nursing home
        │
        ▼
  data/pdfs/             ← local PDF files
  data/centres.json      ← manifest with centre metadata
        │
        ▼
  extractor.py            ← GPT-4o-mini extracts amenities from each PDF
        │
        ▼
  data/extracted/*.json  ← one JSON file per nursing home
```

Downloading only needs to be run once (or whenever new reports are added). Extraction reads from the PDFs and manifest already on disk and can be re-run on its own at any time.

## Prerequisites

- **Python 3.12.x** — Python 3.13+ is not supported yet. Pydantic doesn't have prebuilt wheels for newer Python versions, so installing it tries to compile from source and fails on most machines without a full build toolchain.
- An OpenAI API key (GPT-4o-mini access)

## Setup

```bash
# create a virtual environment using Python 3.12 specifically
py -3.12 -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

python -m pip install --upgrade pip
python -m pip install -r requirements.txt

cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

## Running

```bash
# One-time: download PDFs from the OCI bucket
python downloader.py

# Extract amenities from the downloaded PDFs
python extractor.py
```

Extraction is safe to re-run. Centres that already have an output file in `data/extracted/` are skipped, so interrupting and resuming doesn't waste API calls.

## Output format

Each nursing home produces a JSON file in `data/extracted/<centre_id>.json`:

```json
{
  "centre_id": 184,
  "centre_name": "The Residence Santry",
  "county": "Dublin",
  "inspection_date": "2026-05-21",
  "hiqa_url": "https://www.hiqa.ie/...",
  "amenities": {
    "care_types": ["long-term residential", "dementia care", "respite care"],
    "room_types": ["single room", "en-suite"],
    "has_outdoor_space": true,
    "activities": ["physiotherapy", "occupational therapy", "music therapy"],
    "has_transport": true,
    "has_chapel_or_religious_services": true,
    "special_units": ["secure dementia unit"],
    "dining_notes": "...",
    "other_notes": "..."
  }
}
```

## File structure

```
downloader.py      # downloads PDFs from OCI bucket via index.csv
extractor.py       # GPT-4o-mini amenities extraction (Pydantic schema)
requirements.txt
.python-version
.env.example
.gitignore
data/               # gitignored — generated at runtime
├── pdfs/
├── centres.json
└── extracted/
```

## Scope

Covers all 103 HIQA-registered Dublin nursing homes. Nationwide expansion is supported by the same downloader and extractor, pointed at a bucket covering other counties.

## Not yet done

- **Loading into the shared database.** The extracted JSON isn't loaded into Postgres yet. A separate team pipeline already ingests HIQA compliance data (regulation judgements, inspection history) into a shared schema, this amenities output needs to be reconciled with that schema before loading, rather than written into a separate table on its own.
- **Connecting to the frontend.** Once the data is loaded into the shared database, it needs an API endpoint to serve it and a frontend call to display it. Both depend on the loading step above.

These are planned for the following week, once the shared database schema for amenities is agreed with the rest of the team.
