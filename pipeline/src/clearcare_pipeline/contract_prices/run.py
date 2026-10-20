"""Parsing, transforming and writing contract price lists (CCARE-76).

This is the workflow behind the command line entry point: it reads a list's
file, parses and transforms it, checks it against what the database holds, and
writes the list and its prices in one transaction.
"""

import hashlib
import logging
import tempfile
from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace
from pathlib import Path

import pymupdf

from clearcare_pipeline.contract_prices.database import Catalogue, Writer
from clearcare_pipeline.contract_prices.models import SourceFile
from clearcare_pipeline.contract_prices.transform import (
    TransformError,
    to_contract_price_list,
)
from clearcare_pipeline.parser.fields import Report as ParsedReport
from clearcare_pipeline.parser.fields import extract, load_fields
from clearcare_pipeline.parser.parser import Parser

logger = logging.getLogger(__name__)

# What the stored file's source is called, per home type.
SOURCES = {
    "public": "contract-price-public",
    "private": "contract-price-private",
}


@dataclass(frozen=True)
class PriceListFile:
    """One list to ingest: where its file is, and where it was published."""

    home_type: str
    url: str
    path: Path


@dataclass(frozen=True)
class Summary:
    """What one ingest run did."""

    parsed: int
    written: int
    already_loaded: int
    prices: int
    skipped: int
    failed: int


def parse_price_list(
    body: bytes, home_type: str, mapper: Path, fields_dir: Path
) -> ParsedReport:
    """Parses one list's bytes, through a temporary file.

    The parser reads a file, so the bytes are written to a temporary one
    first. The list's home type names the value mapping, so the two cannot
    disagree about which document this is.
    """
    with tempfile.NamedTemporaryFile(suffix=".pdf") as handle:
        handle.write(body)
        handle.flush()
        path = Path(handle.name)
        sections = Parser(path, mapper).parse()
        fields = fields_dir / f"contract_price_{home_type}_fields.csv"
        return extract(path, sections, load_fields(fields))


def ingest(
    files: Sequence[PriceListFile],
    catalogue: Catalogue,
    writer: Writer,
    *,
    parse: Callable[[bytes, str], ParsedReport],
) -> Summary:
    """Parses, transforms and writes every list.

    A list already loaded from the same bytes is counted and not parsed again.
    A list that cannot be read, whose home type is missing, that says a
    different home type from the option that named it, or that has no price
    for a stored centre, is counted failed and not recorded. A price whose
    centre the register does not have, and one the list does not print as an
    amount, is counted skipped.
    """
    parsed = written = already_loaded = prices = skipped = failed = 0
    for item in files:
        try:
            body = item.path.read_bytes()
        except OSError as error:
            logger.error("%s: %s", item.path, error)
            failed += 1
            continue
        digest = hashlib.sha256(body).hexdigest()
        if catalogue.price_list_loaded(digest):
            logger.info("%s: already loaded", item.path)
            already_loaded += 1
            continue
        try:
            price_list, dropped = to_contract_price_list(
                parse(body, item.home_type)
            )
        except (TransformError, ValueError, pymupdf.FileDataError) as error:
            logger.error("%s: %s", item.path, error)
            failed += 1
            continue
        if price_list.home_type != item.home_type:
            logger.error(
                "%s: the list is %s, named as %s",
                item.path,
                price_list.home_type,
                item.home_type,
            )
            failed += 1
            continue
        for drop in dropped:
            logger.warning(
                "%s: centre %s: %s", item.path, drop.centre_id, drop.reason
            )
            skipped += 1
        kept = tuple(
            price
            for price in price_list.prices
            if _known(item.path, price.centre_id, catalogue)
        )
        skipped += len(price_list.prices) - len(kept)
        if not kept:
            # A list with nothing left is not recorded, or a run made before
            # the register was loaded would count as loaded and its prices
            # would never arrive.
            logger.error(
                "%s: no price in the list is for a stored centre;"
                " load the register first",
                item.path,
            )
            failed += 1
            continue
        parsed += 1
        source_file = SourceFile(
            source=SOURCES[price_list.home_type],
            url=item.url,
            sha256=digest,
        )
        count = writer.write(replace(price_list, prices=kept), source_file)
        if count is None:
            logger.info("%s: already loaded", item.path)
            already_loaded += 1
        else:
            written += 1
            prices += count
    return Summary(
        parsed=parsed,
        written=written,
        already_loaded=already_loaded,
        prices=prices,
        skipped=skipped,
        failed=failed,
    )


def _known(path: Path, centre_id: str, catalogue: Catalogue) -> bool:
    """Whether the register has the centre, warning when it does not."""
    if catalogue.centre_exists(centre_id):
        return True
    logger.warning("%s: no stored centre %s", path, centre_id)
    return False
