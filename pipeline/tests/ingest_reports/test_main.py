"""Tests for the ingest orchestration and its batching."""

import pytest

from clearcare_pipeline.ingest_reports.__main__ import main
from clearcare_pipeline.ingest_reports.run import ingest
from clearcare_pipeline.ingest_reports.sources import Source
from clearcare_pipeline.parser.fields import Report as ParsedReport
from clearcare_pipeline.parser.fields import Value
from tests.ingest_reports.fakes import FakeReportWriter


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


def _sources(count: int) -> list[Source]:
    return [
        Source(name=f"report-{number}.pdf", body=f"%PDF-{number}".encode())
        for number in range(count)
    ]


def test_reports_are_written_in_batches() -> None:
    writer = FakeReportWriter()

    summary = ingest(iter(_sources(5)), writer, parse=_parse, batch_size=2)

    assert [len(batch) for batch in writer.batches] == [2, 2, 1]
    assert summary.parsed == 5
    assert summary.written == 5


def test_unstored_report_is_skipped() -> None:
    writer = FakeReportWriter(known_files=set())

    summary = ingest(iter(_sources(3)), writer, parse=_parse, batch_size=2)

    assert writer.batches == []
    assert summary.skipped == 3
    assert summary.written == 0


def test_rejected_report_is_failed() -> None:
    def parse(body: bytes) -> ParsedReport:
        number = _number(body)
        return _parsed(number, fieldwork=number != 2)

    writer = FakeReportWriter()

    summary = ingest(iter(_sources(3)), writer, parse=parse, batch_size=5)

    assert summary.failed == 1
    assert summary.written == 2


def test_cli_needs_one_source() -> None:
    with pytest.raises(SystemExit):
        main([])
    with pytest.raises(SystemExit):
        main(["--report", "a.pdf", "--prefix", "raw/"])
