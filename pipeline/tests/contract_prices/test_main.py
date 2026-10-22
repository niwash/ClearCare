"""Tests for the command line entry point."""

from pathlib import Path
from typing import NoReturn

import psycopg
import pytest

from clearcare_pipeline.contract_prices.__main__ import main


def test_a_list_is_required() -> None:
    with pytest.raises(SystemExit):
        main([])


def test_a_list_needs_its_path_and_its_url() -> None:
    with pytest.raises(SystemExit):
        main(["--public", "public.pdf"])


def test_the_data_dir_is_not_given_with_a_list(tmp_path: Path) -> None:
    with pytest.raises(SystemExit):
        main(
            [
                "--data-dir",
                str(tmp_path),
                "--public",
                "public.pdf",
                "https://hse.test/public.pdf",
            ]
        )


def test_a_data_dir_without_stored_lists_loads_nothing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def no_database(*args: object, **kwargs: object) -> NoReturn:
        raise AssertionError("connected to the database")

    monkeypatch.setattr(psycopg, "connect", no_database)

    assert main(["--data-dir", str(tmp_path)]) == 0
