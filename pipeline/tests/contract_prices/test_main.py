"""Tests for the command line entry point."""

import pytest

from clearcare_pipeline.contract_prices.__main__ import main


def test_a_list_is_required() -> None:
    with pytest.raises(SystemExit):
        main([])


def test_a_list_needs_its_path_and_its_url() -> None:
    with pytest.raises(SystemExit):
        main(["--public", "public.pdf"])
