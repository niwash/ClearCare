from pathlib import Path

import pytest

from clearcare_pipeline.load_report_files.__main__ import main


def test_broken_manifest_line_fails_the_run(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    manifests = tmp_path / "manifests"
    manifests.mkdir()
    (manifests / "inspection-reports.jsonl").write_text('{"centre_id": "34"}\n')

    # Refused before any connection: the test has no database to reach.
    code = main(["--data-dir", str(tmp_path)])

    assert code == 1
    assert "line 1: not a centre record" in caplog.text


def test_missing_manifest_fails_the_run(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    code = main(["--data-dir", str(tmp_path)])

    assert code == 1
    assert "inspection-reports.jsonl not found" in caplog.text
