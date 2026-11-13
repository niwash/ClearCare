"""Tests for the ingest orchestration and its batching."""

import hashlib
from datetime import date
from pathlib import Path

import pymupdf
import pytest

from clearcare_pipeline.ingest_reports.__main__ import main
from clearcare_pipeline.ingest_reports.models import (
    InspectionReport,
    ThematicReport,
)
from clearcare_pipeline.ingest_reports.run import ingest
from clearcare_pipeline.ingest_reports.sources import Source, from_data_dir
from clearcare_pipeline.parser.fields import Report as ParsedReport
from clearcare_pipeline.parser.fields import Value
from clearcare_pipeline.raw_store import FileSystemRawStore
from tests.ingest_reports.fakes import (
    FakeCatalogue,
    FakeReportWriter,
    write_reports_manifest,
)


def _parsed(number: int, *, fieldwork: bool = True) -> ParsedReport:
    fields: dict[str, Value] = {
        "centre_name": "Fern Valley Nursing Home",
        "address": "Sample Street, Carlow",
        "centre_code": "OSV-0000117",
    }
    if fieldwork:
        fields["fieldwork_id"] = f"MON-{number}"
    return ParsedReport(fields=fields, records={})


def _number(body: bytes) -> int:
    return int(body.decode().removeprefix("%PDF-"))


def _parse(body: bytes) -> ParsedReport:
    return _parsed(_number(body))


def _not_thematic(body: bytes) -> None:
    return None


def _parsed_thematic(number: int) -> ParsedReport:
    return ParsedReport(
        fields={
            "inspection_type": "Unannounced",
            "inspection_date": "21 August 2025",
            "centre_code": "OSV-0000117",
            "fieldwork_id": f"MON-{number}",
        },
        records={"overall_judgment": [{"judgment": "Compliant"}]},
    )


def _report_1_is_thematic(body: bytes) -> ParsedReport | None:
    return _parsed_thematic(1) if _number(body) == 1 else None


def _sources(count: int) -> list[Source]:
    return [
        Source(name=f"report-{number}.pdf", body=f"%PDF-{number}".encode())
        for number in range(count)
    ]


def test_reports_are_written_in_batches() -> None:
    writer = FakeReportWriter()

    summary = ingest(
        iter(_sources(5)),
        FakeCatalogue(),
        writer,
        parse=_parse,
        parse_thematic=_not_thematic,
        batch_size=2,
    )

    assert [len(batch) for batch in writer.batches] == [2, 2, 1]
    assert summary.parsed == 5
    assert summary.written == 5


def test_unstored_report_is_skipped() -> None:
    writer = FakeReportWriter()
    catalogue = FakeCatalogue(known_files=set())

    summary = ingest(
        iter(_sources(3)),
        catalogue,
        writer,
        parse=_parse,
        parse_thematic=_not_thematic,
        batch_size=2,
    )

    assert writer.batches == []
    assert summary.skipped == 3
    assert summary.written == 0


def test_report_for_an_unstored_centre_is_skipped() -> None:
    # The transform reads centre 117 out of the report's Centre ID.
    writer = FakeReportWriter()
    catalogue = FakeCatalogue(known_centres=set())

    summary = ingest(
        iter(_sources(3)),
        catalogue,
        writer,
        parse=_parse,
        parse_thematic=_not_thematic,
        batch_size=2,
    )

    assert writer.batches == []
    assert summary.skipped == 3
    assert summary.written == 0


def test_report_for_a_stored_centre_is_not_skipped() -> None:
    writer = FakeReportWriter()
    catalogue = FakeCatalogue(known_centres={"117"})

    summary = ingest(
        iter(_sources(2)),
        catalogue,
        writer,
        parse=_parse,
        parse_thematic=_not_thematic,
        batch_size=2,
    )

    assert summary.skipped == 0
    assert summary.written == 2


def test_report_already_loaded_is_not_parsed() -> None:
    def parse(body: bytes) -> ParsedReport:
        raise AssertionError("parsed a report that is already loaded")

    items = _sources(2)
    loaded = {hashlib.sha256(item.body).hexdigest() for item in items}

    summary = ingest(
        iter(items),
        FakeCatalogue(loaded_files=loaded),
        FakeReportWriter(),
        parse=parse,
        parse_thematic=_not_thematic,
        batch_size=5,
    )

    assert summary.already_loaded == 2
    assert summary.skipped == 0


def test_a_report_that_cannot_be_read_is_failed() -> None:
    def parse(body: bytes) -> ParsedReport:
        if _number(body) == 1:
            raise pymupdf.FileDataError("cannot open broken.pdf")
        return _parsed(_number(body))

    writer = FakeReportWriter()

    summary = ingest(
        iter(_sources(3)),
        FakeCatalogue(),
        writer,
        parse=parse,
        parse_thematic=_not_thematic,
        batch_size=5,
    )

    assert summary.failed == 1
    assert summary.written == 2


def test_a_missing_or_altered_raw_file_fails_only_that_report(
    tmp_path: Path,
) -> None:
    store = FileSystemRawStore(tmp_path / "raw")
    altered = store.path_for("cd" * 32)
    altered.parent.mkdir(parents=True)
    altered.write_bytes(b"%PDF-4")
    write_reports_manifest(
        tmp_path,
        {
            "1.pdf": store.put(b"%PDF-1"),
            "2.pdf": "ab" * 32,
            "3.pdf": store.put(b"%PDF-3"),
            "4.pdf": "cd" * 32,
        },
    )
    writer = FakeReportWriter()

    summary = ingest(
        from_data_dir(tmp_path),
        FakeCatalogue(),
        writer,
        parse=_parse,
        parse_thematic=_not_thematic,
        batch_size=50,
    )

    assert summary.failed == 2
    assert summary.written == 2


def test_rejected_report_is_failed() -> None:
    def parse(body: bytes) -> ParsedReport:
        number = _number(body)
        return _parsed(number, fieldwork=number != 2)

    writer = FakeReportWriter()

    summary = ingest(
        iter(_sources(3)),
        FakeCatalogue(),
        writer,
        parse=parse,
        parse_thematic=_not_thematic,
        batch_size=5,
    )

    assert summary.failed == 1
    assert summary.written == 2


def test_thematic_report_is_loaded_in_the_batch_it_comes_in() -> None:
    writer = FakeReportWriter()

    summary = ingest(
        iter(_sources(3)),
        FakeCatalogue(),
        writer,
        parse=_parse,
        parse_thematic=_report_1_is_thematic,
        batch_size=5,
    )

    assert [type(report) for batch in writer.batches for report in batch] == [
        InspectionReport,
        ThematicReport,
        InspectionReport,
    ]
    assert writer.batches[0][1] == ThematicReport(
        source_file_id=1,
        centre_id="117",
        centre_code="OSV-0000117",
        inspection_type="Unannounced",
        inspection_date=date(2025, 8, 21),
        fieldwork_id="MON-1",
        overall_judgment="Compliant",
    )
    assert summary.parsed == 3
    assert summary.written == 3
    assert summary.failed == 0


def test_thematic_report_is_not_given_to_the_regulation_parser() -> None:
    def parse(body: bytes) -> ParsedReport:
        if _number(body) == 1:
            raise AssertionError("parsed a thematic report's regulations")
        return _parsed(_number(body))

    summary = ingest(
        iter(_sources(3)),
        FakeCatalogue(),
        FakeReportWriter(),
        parse=parse,
        parse_thematic=_report_1_is_thematic,
        batch_size=5,
    )

    assert summary.written == 3


def test_thematic_report_for_an_unstored_centre_is_skipped() -> None:
    writer = FakeReportWriter()
    catalogue = FakeCatalogue(known_centres=set())

    summary = ingest(
        iter(_sources(2)),
        catalogue,
        writer,
        parse=_parse,
        parse_thematic=_report_1_is_thematic,
        batch_size=5,
    )

    assert writer.batches == []
    assert summary.skipped == 2


def test_thematic_report_missing_a_value_is_failed() -> None:
    def parse_thematic(body: bytes) -> ParsedReport | None:
        if _number(body) != 1:
            return None
        return ParsedReport(
            fields={**_parsed_thematic(1).fields, "fieldwork_id": None},
            records=_parsed_thematic(1).records,
        )

    writer = FakeReportWriter()

    summary = ingest(
        iter(_sources(3)),
        FakeCatalogue(),
        writer,
        parse=_parse,
        parse_thematic=parse_thematic,
        batch_size=5,
    )

    assert summary.failed == 1
    assert summary.written == 2


def test_cli_needs_one_source() -> None:
    with pytest.raises(SystemExit):
        main([])
    with pytest.raises(SystemExit):
        main(["--report", "a.pdf", "--prefix", "raw/"])
