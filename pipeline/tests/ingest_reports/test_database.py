"""Database tests for the ingest's catalogue and writer. These need Docker."""

from dataclasses import replace
from datetime import date, time
from pathlib import Path

import pytest

from clearcare_pipeline.extract_text import backfill
from clearcare_pipeline.ingest_reports.database import (
    DatabaseCatalogue,
    ReportWriter,
)
from clearcare_pipeline.ingest_reports.models import (
    InspectionComplianceItem,
    InspectionInspector,
    InspectionRegulation,
    InspectionReport,
)
from clearcare_pipeline.ingest_reports.run import parse_report
from clearcare_pipeline.raw_store import FileSystemRawStore
from tests.database import API, PIPELINE, migrated_database

SHA = "ab" * 32

# Stores one download of SHA, as the downloader would, and returns its id.
STORE = (
    "INSERT INTO clearcare.source_file"
    " (source, url, sha256, fetched_at)"
    " VALUES ('inspection-reports', %s, %s, now())"
    " RETURNING source_file_id"
)


def _report(source_file_id: int) -> InspectionReport:
    return InspectionReport(
        source_file_id=source_file_id,
        centre_id="117",
        centre_code="OSV-0000117",
        centre_name="Fern Valley Nursing Home",
        provider_name="Fern Valley Care Limited",
        address="Sample Street, Carlow",
        inspection_type="Unannounced",
        inspection_date=date(2025, 12, 5),
        fieldwork_id="MON-0048985",
        residents=48,
        inspectors=(
            InspectionInspector(
                date=date(2025, 12, 5),
                start_time=time(9, 0),
                end_time=time(17, 20),
                name="A. Inspector",
                role="Lead",
            ),
        ),
        regulations=(
            InspectionRegulation(
                regulation="Regulation 15",
                title="Staffing",
                judgment="Compliant",
            ),
        ),
        compliance_items=(
            InspectionComplianceItem(
                regulation="Regulation 16(1)(a)",
                requirement="Staff receive appropriate training.",
                judgment="Not Compliant",
                risk_rating="Orange",
                date_to_comply=date(2026, 9, 1),
            ),
        ),
    )


@pytest.mark.database
def test_batch_is_written_once() -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        # main() connects with autocommit, so each batch commits on its own.
        connection.autocommit = True
        connection.execute(
            "INSERT INTO clearcare.centre (centre_id) VALUES ('117')"
        )
        stored = connection.execute(
            STORE, ("https://example.test/r.pdf", SHA)
        ).fetchone()
        assert stored is not None
        source_file_id = stored[0]
        catalogue = DatabaseCatalogue(connection)
        writer = ReportWriter(connection, "test-version")

        assert catalogue.source_file_id(SHA) == source_file_id
        assert catalogue.centre_exists("117")
        assert not catalogue.report_loaded(SHA)
        assert writer.write_batch([_report(source_file_id)]) == 1
        # Writing the same report again adds nothing.
        assert writer.write_batch([_report(source_file_id)]) == 0
        assert DatabaseCatalogue(connection).report_loaded(SHA)

        counts = connection.execute(
            "SELECT"
            " (SELECT count(*) FROM clearcare.inspection_report),"
            " (SELECT count(*) FROM clearcare.inspection_inspector),"
            " (SELECT count(*) FROM clearcare.inspection_regulation),"
            " (SELECT count(*) FROM clearcare.inspection_compliance_item)"
        ).fetchone()
        assert counts == (1, 1, 1, 1)

        inspector = connection.execute(
            "SELECT date, start_time, end_time, name, role"
            " FROM clearcare.inspection_inspector"
        ).fetchone()
        assert inspector == (
            date(2025, 12, 5),
            time(9, 0),
            time(17, 20),
            "A. Inspector",
            "Lead",
        )

        regulation = connection.execute(
            "SELECT regulation, title, judgment"
            " FROM clearcare.inspection_regulation"
        ).fetchone()
        assert regulation == ("Regulation 15", "Staffing", "Compliant")

        # The batch is committed, not merely visible in this transaction.
        with database.connect(PIPELINE) as other:
            seen = other.execute(
                "SELECT count(*) FROM clearcare.inspection_report"
            ).fetchone()
        assert seen == (1,)


@pytest.mark.database
def test_unstored_file_is_not_found() -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        catalogue = DatabaseCatalogue(connection)

        assert catalogue.source_file_id(SHA) is None
        assert not catalogue.centre_exists("117")


@pytest.mark.database
def test_centre_is_found_only_when_loaded() -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        assert not DatabaseCatalogue(connection).centre_exists("117")

        connection.execute(
            "INSERT INTO clearcare.centre (centre_id) VALUES ('117')"
        )
        catalogue = DatabaseCatalogue(connection)

        assert catalogue.centre_exists("117")
        assert not catalogue.centre_exists("118")


@pytest.mark.database
def test_catalogue_takes_the_newest_download_of_a_file() -> None:
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        # The same bytes downloaded twice: each download is its own row.
        connection.execute(
            "INSERT INTO clearcare.source_file"
            " (source, url, sha256, fetched_at)"
            " VALUES ('inspection-reports', 'https://example.test/old.pdf',"
            " %s, now() - interval '1 day')",
            (SHA,),
        )
        newest = connection.execute(
            STORE, ("https://example.test/new.pdf", SHA)
        ).fetchone()
        assert newest is not None

        assert DatabaseCatalogue(connection).source_file_id(SHA) == newest[0]


@pytest.mark.database
def test_report_text_is_stored_once_with_pages_and_version(
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    parser = Path(__file__).parents[2] / "src/clearcare_pipeline/parser"
    body = (Path(__file__).parents[1] / "fixtures/test_parser.pdf").read_bytes()
    digest = FileSystemRawStore(tmp_path / "raw").put(body)
    parsed = parse_report(body, parser / "mapper.csv", parser / "fields.csv")
    with (
        migrated_database() as database,
        database.connect(PIPELINE) as connection,
    ):
        connection.autocommit = True
        connection.execute(
            "INSERT INTO clearcare.centre (centre_id) VALUES ('117')"
        )
        stored = connection.execute(
            STORE, ("https://example.test/report.pdf", digest)
        ).fetchone()
        assert stored is not None
        report = replace(
            _report(stored[0]),
            text=tuple(
                row
                for row in parsed.text
                if (row.kind, row.regulation) != ("response", "Regulation 25")
            ),
            regulations=(
                InspectionRegulation(
                    "Regulation 25", "Temporary absence", "Not compliant"
                ),
            ),
        )
        writer = ReportWriter(connection, "test-version")
        assert writer.write_batch([report]) == 1
        assert writer.write_batch([report]) == 0
        with database.connect(API) as reader:
            row = reader.execute(
                "SELECT regulation, first_page, last_page, extractor_version,"
                " text FROM clearcare.report_text WHERE kind = 'narrative'"
                " AND regulation = 'Regulation 23'"
            ).fetchone()
        assert row is not None
        assert row[:4] == ("Regulation 23", 9, 10, "test-version")
        assert row[4].endswith("Judgment: Not compliant")
        with database.connect(API) as reader:
            response = reader.execute(
                "SELECT text, first_page, last_page, page_offsets"
                " FROM clearcare.report_text WHERE kind = 'response'"
                " AND regulation = 'Regulation 27'"
            ).fetchone()
        assert response is not None
        assert response[1:3] == (25, 26)
        assert response[3] == [
            response[0].index("The registered provider recognises")
        ]
        # A new extractor version backfills existing reports once; ingest's
        # version already has its rows, so it is never parsed again.
        summary = backfill(connection, tmp_path, "test-version", batch_size=1)
        assert (summary.written, summary.failed) == (0, 1)
        assert "report 1" in caplog.text
        assert "Regulation 25: no response stored" in caplog.text
        assert (
            backfill(connection, tmp_path, "next-version", batch_size=1).written
            == 1
        )
        assert (
            backfill(connection, tmp_path, "next-version", batch_size=1).written
            == 0
        )
        counts = connection.execute(
            "SELECT extractor_version, count(*)"
            " FROM clearcare.inspection_report_text"
            " GROUP BY extractor_version ORDER BY extractor_version"
        ).fetchall()
        assert counts == [
            ("next-version", len(parsed.text)),
            ("test-version", len(parsed.text) - 1),
        ]
