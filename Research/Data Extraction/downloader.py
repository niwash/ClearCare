"""
downloader.py
-------------
Downloads the most recent HIQA inspection report PDF for each Dublin nursing home from the Oracle Cloud object storage bucket.

The bucket already provides an index.csv with all the metadata we need: centre names, inspection dates, file names. 
No HIQA website scraping required.

Usage
-----
    python downloader.py

Output
------
data/pdfs/<centre_id>-<file_name>.pdf   - one PDF per nursing home
data/centres.json                       - manifest used by the extractor
"""

import csv
import io
import json
import logging
import time
from pathlib import Path
from urllib.parse import quote

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Pre-authenticated request URL for the Oracle Cloud bucket.
# All PDF files and the index.csv are served from this base URL.
BUCKET_BASE_URL = (
    "https://lrphbuio4yje.objectstorage.uk-london-1.oci.customer-oci.com"
    "/p/byX5qddcJ9rUrTCijSm3XbL_41Tob_nWuN5hoCt3PVsyHBqH3Vbb1svmHB3_6Snc"
    "/n/lrphbuio4yje/b/clearcare-raw/o/"
)

INDEX_CSV_OBJECT = "share/dublin-reports/index.csv"
PDF_OBJECT_PREFIX = "share/dublin-reports/"

PDF_DIR = Path("data/pdfs")
MANIFEST_PATH = Path("data/centres.json")

HEADERS = {"User-Agent": "ClearCare-Research/1.0 (TU Dublin MSc project)"}
REQUEST_DELAY_SECONDS = 0.5  # pause between PDF downloads

# ---------------------------------------------------------------------------


def fetch_index_csv(session: requests.Session) -> list[dict]:
    """
    Downloads index.csv from the bucket and returns it as a list of dicts.
    The CSV has columns: file_name, centre_id, centre_name, county,
    inspection_date, report_type, published_date, sha256, size_bytes, hiqa_url
    """
    url = BUCKET_BASE_URL + INDEX_CSV_OBJECT
    log.info("Fetching index.csv from bucket...")
    resp = session.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()

    reader = csv.DictReader(io.StringIO(resp.text))
    rows = list(reader)
    log.info("Index has %d report entries across all centres.", len(rows))
    return rows


def pick_most_recent_per_centre(rows: list[dict]) -> list[dict]:
    """
    Groups all rows by centre_id and returns only the row with the latest
    inspection_date for each centre.
    inspection_date is in YYYY-MM-DD format, so lexicographic max() works fine.
    """
    best: dict[str, dict] = {}  # centre_id -> best row so far

    for row in rows:
        cid = row["centre_id"]
        date = row["inspection_date"]
        if cid not in best or date > best[cid]["inspection_date"]:
            best[cid] = row

    return sorted(best.values(), key=lambda r: r["centre_name"])


def download_pdf(session: requests.Session, file_name: str, dest: Path) -> bool:
    """
    Downloads a single PDF from the bucket to dest.
    URL-encodes the filename to handle spaces and special characters.
    Returns True on success.
    """
    # quote() handles spaces (-> %20), apostrophes (-> %27), etc.
    encoded = quote(file_name)
    url = BUCKET_BASE_URL + PDF_OBJECT_PREFIX + encoded

    try:
        resp = session.get(url, headers=HEADERS, timeout=60, stream=True)
        resp.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except Exception as e:
        log.error("  Download failed for %s: %s", file_name, e)
        return False


def run_downloader():
    """Main entry point. Downloads one PDF per centre and writes the manifest."""
    PDF_DIR.mkdir(parents=True, exist_ok=True)

    with requests.Session() as session:
        all_rows = fetch_index_csv(session)
        latest_rows = pick_most_recent_per_centre(all_rows)
        log.info("Unique centres: %d. Will download one PDF each.", len(latest_rows))

        manifest = []

        for i, row in enumerate(latest_rows, start=1):
            centre_id = row["centre_id"]
            centre_name = row["centre_name"].strip()
            file_name = row["file_name"]
            inspection_date = row["inspection_date"]

            # Prefix with centre_id to guarantee a unique filename on disk
            dest = PDF_DIR / f"{centre_id}-{file_name}"

            log.info("[%d/%d] %s (%s)", i, len(latest_rows), centre_name, inspection_date)

            if dest.exists():
                log.info("  Already downloaded, skipping.")
                pdf_path = str(dest)
            else:
                success = download_pdf(session, file_name, dest)
                pdf_path = str(dest) if success else None
                time.sleep(REQUEST_DELAY_SECONDS)

            # Store all the metadata from the index -- the extractor will use this
            # instead of asking the LLM to figure out the name/date from the PDF text.
            manifest.append({
                "centre_id": int(centre_id),
                "centre_name": centre_name,
                "county": row["county"],
                "inspection_date": inspection_date,
                "file_name": file_name,
                "pdf_path": pdf_path,
                "hiqa_url": row.get("hiqa_url", ""),
            })

        # Write the manifest -- this is the handoff file between downloader and extractor
        MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)

        downloaded = sum(1 for c in manifest if c["pdf_path"])
        log.info("Done. %d / %d PDFs downloaded. Manifest: %s", downloaded, len(manifest), MANIFEST_PATH)


if __name__ == "__main__":
    run_downloader()
