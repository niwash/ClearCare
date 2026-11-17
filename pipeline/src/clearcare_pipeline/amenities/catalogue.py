"""Select each centre's latest parsed source before checking amenities."""

import logging
from pathlib import Path
from urllib.parse import unquote, urlparse

from clearcare_pipeline.amenities.extractor import EXTRACTOR_VERSION
from clearcare_pipeline.ingest_reports.database import Connection

logger = logging.getLogger(__name__)


def reports(
    connection: Connection, *, pending_only: bool = False
) -> dict[str, dict[str, str]]:
    """Use database dates and the API's report tie-break, never the manifest."""
    query = """
        WITH latest AS (
            SELECT DISTINCT ON (r.centre_id)
                r.id, r.centre_id, r.inspection_date, s.sha256, s.url
            FROM clearcare.inspection_report r
            JOIN clearcare.source_file s USING (source_file_id)
            ORDER BY r.centre_id, r.inspection_date DESC NULLS LAST, r.id
        )
        SELECT r.centre_id, r.inspection_date, r.sha256, r.url FROM latest r
    """
    params: tuple[str, ...] = ()
    if pending_only:
        query += """
            WHERE NOT EXISTS (
                SELECT 1 FROM clearcare.report_amenities_v2 a
                WHERE a.report_id = r.id AND a.extractor_version = %s
            )
        """
        params = (EXTRACTOR_VERSION,)
    query += " ORDER BY r.centre_id"
    selected: dict[str, dict[str, str]] = {}
    for centre, date, digest, url in connection.execute(query, params):
        if date is None:
            logger.warning("No inspection date for centre %s; skipping", centre)
            continue
        selected[str(centre)] = {
            "inspection_date": date.isoformat(),
            "sha256": str(digest),
            "url": str(url),
            "file_name": unquote(Path(urlparse(str(url)).path).name),
        }
    return selected
