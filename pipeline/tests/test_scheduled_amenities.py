"""Retry and persistence checks with synthetic results and no model calls."""

from datetime import UTC, datetime
from pathlib import Path
from typing import cast
from unittest.mock import MagicMock

import pytest

from clearcare_pipeline.amenities import __main__ as stage
from clearcare_pipeline.amenities.catalogue import reports
from clearcare_pipeline.amenities.extractor import output_file
from clearcare_pipeline.amenities_v2 import ExtractionFile
from clearcare_pipeline.exit_codes import EXIT_RETRY
from clearcare_pipeline.ingest_reports.database import Connection
from clearcare_pipeline.load_amenities import Summary
from clearcare_pipeline.object_store import ObjectStoreError
from tests.database import PIPELINE, migrated_database
from tests.object_store_fakes import FakeObjectStore

CONNECTION = cast(Connection, object())
SOURCE = {
    "inspection_date": "2026-01-01",
    "sha256": "ab" * 32,
    "url": "https://www.hiqa.ie/synthetic.pdf",
    "file_name": "synthetic.pdf",
}


def result(centre: str) -> ExtractionFile:
    return ExtractionFile.model_validate(
        {
            "centre_id": centre,
            "inspection_date": SOURCE["inspection_date"],
            "file_name": SOURCE["file_name"],
            "hiqa_url": SOURCE["url"],
            "sha256": SOURCE["sha256"],
            "model": "synthetic-model",
            "extractor_version": "amenities-v2",
            "extracted_at": datetime(2026, 1, 2, tzinfo=UTC),
            "amenities": {
                "care_types": [],
                "room_types": [],
                "activities": [],
                "facilities": [],
            },
        }
    )


class Harness:
    def __init__(self, monkeypatch: pytest.MonkeyPatch, count: int = 1):
        self.pending = {str(i): dict(SOURCE) for i in range(1, count + 1)}
        self.asked: list[str] = []
        self.loaded: list[str] = []
        self.failures: set[str] = set()
        monkeypatch.setattr(stage, "reports", self.reports)
        monkeypatch.setattr(stage, "load", self.load)

    def reports(
        self,
        connection: Connection,
        *,
        pending_only: bool,
    ) -> dict[str, dict[str, str]]:
        assert pending_only
        return dict(self.pending)

    def extract(
        self,
        centre: str,
        source: dict[str, str],
        directory: Path,
    ) -> bool:
        self.asked.append(centre)
        if centre in self.failures:
            return False
        path = output_file(directory, centre, source["sha256"])
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(result(centre).model_dump_json())
        return True

    def load(
        self,
        connection: Connection,
        records: list[ExtractionFile],
        *,
        data_dir: Path,
    ) -> Summary:
        centre = records[0].centre_id
        self.loaded.append(centre)
        self.pending.pop(centre)
        return Summary(1, 0, 0)


def test_restarting_with_no_local_files_does_not_repeat_paid_work(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    h = Harness(monkeypatch)
    archive = FakeObjectStore()
    assert (
        stage.run(CONNECTION, tmp_path / "task1", h.extract, store=archive) == 0
    )
    assert (
        stage.run(CONNECTION, tmp_path / "task2", h.extract, store=archive) == 0
    )
    assert h.asked == ["1"]
    assert h.loaded == ["1"]
    assert len(archive.objects) == 1


def test_archive_is_saved_before_load_and_reused_after_failed_load(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    h = Harness(monkeypatch)
    archive = FakeObjectStore()

    def failed_load(*args: object, **kwargs: object) -> Summary:
        assert len(archive.objects) == 1
        raise ValueError("source is temporarily unmatched")

    monkeypatch.setattr(stage, "load", failed_load)
    with pytest.raises(ValueError, match="temporarily unmatched"):
        stage.run(CONNECTION, tmp_path / "task1", h.extract, store=archive)
    monkeypatch.setattr(stage, "load", h.load)
    assert (
        stage.run(CONNECTION, tmp_path / "task2", h.extract, store=archive) == 0
    )
    assert h.asked == ["1"]


def test_failed_extraction_is_retried_and_successful_homes_are_loaded(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    h = Harness(monkeypatch, 2)
    h.failures.add("1")
    assert stage.run(CONNECTION, tmp_path, h.extract) == EXIT_RETRY
    assert h.loaded == ["2"]
    h.failures.clear()
    assert stage.run(CONNECTION, tmp_path, h.extract) == 0
    assert h.asked == ["1", "2", "1"]


def test_limit_and_consecutive_failures_bound_paid_attempts(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    h = Harness(monkeypatch, 5)
    assert stage.run(CONNECTION, tmp_path, h.extract, limit=2) == EXIT_RETRY
    assert h.asked == ["1", "2"]
    h.failures.update(h.pending)
    assert stage.run(CONNECTION, tmp_path, h.extract) == EXIT_RETRY
    assert h.asked == ["1", "2", "3", "4", "5"]


def test_corrupt_archive_is_not_overwritten_or_loaded(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    h = Harness(monkeypatch)
    key = f"{stage.ARCHIVE_PREFIX}1/{SOURCE['sha256']}.json"
    archive = FakeObjectStore({key: b"broken"})
    with pytest.raises(ValueError):
        stage.run(CONNECTION, tmp_path, h.extract, store=archive)
    assert h.asked == h.loaded == []
    assert archive.objects[key] == b"broken"


def test_archive_failure_prevents_loading(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    h = Harness(monkeypatch)
    key = f"{stage.ARCHIVE_PREFIX}1/{SOURCE['sha256']}.json"
    archive = FakeObjectStore(failing_keys=frozenset({key}))
    with pytest.raises(ObjectStoreError):
        stage.run(CONNECTION, tmp_path, h.extract, store=archive)
    assert h.loaded == []


def test_stage_is_off_by_default_without_touching_database(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def forbidden(*args: object, **kwargs: object) -> None:
        pytest.fail("disabled stage must not connect")

    monkeypatch.setattr(stage.psycopg, "connect", forbidden)
    assert stage.main(["--data-dir", str(tmp_path)], env={}) == 0
    assert (
        stage.main(
            ["--data-dir", str(tmp_path)], env={"CLEARCARE_AMENITIES": "wrong"}
        )
        == 1
    )


@pytest.mark.database
def test_latest_report_is_selected_before_skipping_loaded_versions() -> None:
    with migrated_database() as database, database.connect(PIPELINE) as conn:
        conn.execute(
            "INSERT INTO clearcare.centre (centre_id) VALUES ('117'), ('118')"
        )
        ids: list[int] = []
        for number, centre, date in [
            (1, "117", "2025-01-01"),
            (2, "117", "2026-01-01"),
            (3, "117", "2026-01-01"),
            (4, "118", None),
        ]:
            source = conn.execute(
                "INSERT INTO clearcare.source_file"
                " (source, url, sha256, fetched_at)"
                " VALUES ('inspection-reports', %s, %s, now())"
                " RETURNING source_file_id",
                (
                    f"https://www.hiqa.ie/report%20{number}.pdf",
                    str(number) * 64,
                ),
            ).fetchone()
            assert source is not None
            row = conn.execute(
                "INSERT INTO clearcare.inspection_report"
                " (source_file_id, centre_id, centre_code, centre_name,"
                " address, inspection_date, fieldwork_id)"
                " VALUES (%s, %s, %s, 'Synthetic home',"
                " 'Synthetic street', %s, %s)"
                " RETURNING id",
                (source[0], centre, f"OSV-{centre}", date, f"MON-{number}"),
            ).fetchone()
            assert row is not None
            ids.append(int(row[0]))
        chosen = reports(conn, pending_only=True)
        assert list(chosen) == ["117"]
        assert chosen["117"]["sha256"] == "2" * 64
        assert chosen["117"]["inspection_date"] == "2026-01-01"
        assert chosen["117"]["file_name"] == "report 2.pdf"
        sql = """
            INSERT INTO clearcare.report_amenities_v2
                (report_id, amenities, file_name, hiqa_url,
                 extractor_version, model, extracted_at)
            VALUES (%s,
                '{"care_types":[],"room_types":[],
                  "activities":[],"facilities":[]}',
                'synthetic.pdf', 'https://www.hiqa.ie/synthetic.pdf',
                %s, 'synthetic-model', now())
        """
        # An older report's extraction cannot hide a newer report.
        conn.execute(sql, (ids[0], "amenities-v2"))
        assert reports(conn, pending_only=True) == chosen
        # A different version of the same report cannot suppress v2 work.
        conn.execute(sql, (ids[1], "synthetic-other-version"))
        assert reports(conn, pending_only=True) == chosen
        conn.execute(sql, (ids[1], "amenities-v2"))
        # Do not backfill the later ID with the same date, or the older report.
        assert reports(conn, pending_only=True) == {}


def test_no_pending_work_does_not_need_a_key_or_model_client(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    Harness(monkeypatch, 0)
    context = MagicMock()
    context.__enter__.return_value = CONNECTION
    monkeypatch.setattr(
        stage.psycopg, "connect", MagicMock(return_value=context)
    )
    assert (
        stage.main(
            ["--data-dir", str(tmp_path)], env={"CLEARCARE_AMENITIES": "on"}
        )
        == 0
    )


def test_missing_key_fails_before_extraction(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    h = Harness(monkeypatch)
    context = MagicMock()
    context.__enter__.return_value = CONNECTION
    monkeypatch.setattr(
        stage.psycopg, "connect", MagicMock(return_value=context)
    )
    assert (
        stage.main(
            ["--data-dir", str(tmp_path)], env={"CLEARCARE_AMENITIES": "on"}
        )
        == 1
    )
    assert h.loaded == []


def test_dry_run_lists_pending_sources_without_loading_or_model_calls(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    h = Harness(monkeypatch)
    context = MagicMock()
    context.__enter__.return_value = CONNECTION
    monkeypatch.setattr(
        stage.psycopg, "connect", MagicMock(return_value=context)
    )
    assert stage.main(["--data-dir", str(tmp_path), "--dry-run"], env={}) == 0
    assert h.loaded == h.asked == []


def test_provider_auth_errors_are_fatal_for_scheduled_extraction() -> None:
    from clearcare_pipeline.amenities.extractor import call_anthropic

    response = MagicMock(status_code=401)
    client = MagicMock()
    client.messages.parse.side_effect = stage.anthropic.APIStatusError(
        "authentication refused",
        response=response,
        body=None,
    )
    with pytest.raises(ValueError, match="authentication"):
        call_anthropic(client, "synthetic text", raise_on_auth_error=True)
