"""Approved amenities-v2 structured output and extraction-file validation."""

import re
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from itertools import pairwise
from typing import Literal, Self, cast, get_args
from urllib.parse import urlsplit

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)


class StrictModel(BaseModel):
    """Reject unknown keys and coercion in canonical v2 data."""

    model_config = ConfigDict(extra="forbid", strict=True)


class Evidence(StrictModel):
    """A continuous source passage with original PDF page bounds."""

    quote: str
    page_start: int = Field(ge=1)
    page_end: int = Field(ge=1)

    @model_validator(mode="after")
    def valid_passage(self) -> Self:
        """Reject whitespace-only quotes and reversed page ranges."""
        if not self.quote.strip() or self.page_end < self.page_start:
            raise ValueError(
                "Evidence requires source words and an ordered page range"
            )
        return self


class CareTypesItem(StrictModel):
    """One approved care category and its supporting passages."""

    item: Literal[
        "General nursing care",
        "Long-term residential care",
        "Short-term care",
        "Respite care",
        "Convalescent care",
        "Transitional care",
        "Step-down care",
        "Rehabilitation",
        "Day care",
        "Dementia care",
        "Palliative care",
        "End-of-life care",
        "Acquired brain injury care",
        "Physical disability care",
        "Sensory impairment care",
        "Neurological care",
        "Intellectual disability care",
        "Mental health care",
    ]
    evidence: list[Evidence] = Field(min_length=1)


class RoomTypesItem(StrictModel):
    """One approved room category and its supporting passages."""

    item: Literal[
        "Single room",
        "Twin/double room",
        "Multi-bed room",
        "Shared room, occupancy unspecified",
        "En-suite facilities",
        "Shared bathroom facilities",
    ]
    evidence: list[Evidence] = Field(min_length=1)


class ActivitiesItem(StrictModel):
    """One approved activity category and its supporting passages."""

    item: Literal[
        "Music and singing",
        "Dancing",
        "Drama and performances",
        "Arts and crafts",
        "Knitting and sewing",
        "Cooking and baking",
        "Gardening and flower arranging",
        "Bingo",
        "Quizzes and word games",
        "Board and card games",
        "Ball and movement games",
        "Reading and writing",
        "Talks and discussion groups",
        "Exercise classes",
        "Walking",
        "Outings",
        "Social gatherings and celebrations",
        "Men’s groups",  # noqa: RUF001 - approved exact category
        "Films and television",
        "Radio",
        "Reminiscence activities",
        "Sensory activities",
        "Cognitive stimulation therapy",
        "Sonas",
        "Physiotherapy",
        "Occupational therapy",
        "Music therapy",
        "Art therapy",
        "Pet therapy",
        "Aromatherapy",
        "Meditation and relaxation",
        "Hairdressing",
        "Beauty and nail care",
        "Massage",
        "Religious services and prayer",
    ]
    evidence: list[Evidence] = Field(min_length=1)


class FacilitiesItem(StrictModel):
    """One approved facility category and its supporting passages."""

    item: Literal[
        "Garden",
        "Courtyard",
        "Patio/terrace",
        "Balcony",
        "Outdoor space, type unspecified",
        "Lounge/day room",
        "Dining room",
        "Activities room",
        "Private visitors/family room",
        "Conservatory/sun room",
        "Quiet/relaxation room",
        "Chapel/oratory",
        "Prayer/reflection room",
        "Library",
        "Cinema room",
        "Games room",
        "Sensory room",
        "Gym",
        "Café/coffee dock",
        "Shop",
        "Hairdressing/beauty salon",
        "Designated smoking area",
        "Physiotherapy room",
        "Occupational therapy room",
        "Hydrotherapy pool/bathroom",
        "Resident internet/Wi-Fi",
        "Visitor parking",
        "Passenger lift",
        "Stairlift",
        "Dementia-specific unit",
        "Mental-health-specific unit",
        "Acquired-brain-injury unit",
        "Convalescence unit",
        "Centre-provided bus/car transport",
    ]
    evidence: list[Evidence] = Field(min_length=1)


# Derive stable order from the same Literal choices used for validation.
CATEGORY_ORDER = {
    field: list(
        cast(tuple[str, ...], get_args(model.model_fields["item"].annotation))
    )
    for field, model in (
        ("care_types", CareTypesItem),
        ("room_types", RoomTypesItem),
        ("activities", ActivitiesItem),
        ("facilities", FacilitiesItem),
    )
}


SelectedItem = CareTypesItem | RoomTypesItem | ActivitiesItem | FacilitiesItem


@dataclass(frozen=True)
class EvidenceCheck:
    """What verify_evidence changed in one report.

    dropped holds (list name, item name, quote) for each quote found nowhere
    in the report.
    """

    items_kept: int = 0
    items_dropped: int = 0
    evidence_corrected: int = 0
    evidence_dropped: int = 0
    dropped: tuple[tuple[str, str, str], ...] = ()


# Dashes and the soft hyphen read as hyphens. casefold() expands the fi and
# fl ligatures.
_SAME_CHARACTERS = str.maketrans({"\u2013": "-", "\u2014": "-", "\u00ad": "-"})
# A hyphen reads as a space, so "en-suite" matches "en suite" and the two
# halves of "single-bedroom" stay two words. Where a word is split at the end
# of a PDF line ("gar-" then "den"), the page is also searched with the hyphen
# and the line break removed.
_LINE_END_HYPHEN = re.compile(r"-[^\S\n]*\n\s*")
# Punctuation carries no meaning for this check: the model adds commas the
# report does not have ("6 twin rooms, and 1"), and quotes end with a full
# stop where the report's sentence goes on. Anything other than a letter, a
# digit or a space goes.
_PUNCTUATION = re.compile(r"[^\w\s]|_")
# HIQA prints "Page N of M" as the last line of every page, so the footer
# sits inside any passage that runs over a page break.
_PAGE_FOOTER = re.compile(r"\s*Page \d+ of \d+\s*$")


def _normalise(text: str) -> str:
    """Casefolded words, hyphens as spaces, no punctuation, single spaces."""
    text = text.translate(_SAME_CHARACTERS).replace("-", " ")
    return " ".join(_PUNCTUATION.sub("", text).split()).casefold()


def _page_variants(text: str) -> tuple[str, str]:
    """The normalised page, as printed and with line-end hyphens joined."""
    text = text.translate(_SAME_CHARACTERS)
    return _normalise(text), _normalise(_LINE_END_HYPHEN.sub("", text))


def _not_inside_a_number(phrase: str) -> re.Pattern[str]:
    """Matches the phrase only where no digit touches either end.

    So "2 single rooms" is not found in "12 single rooms". A letter may touch
    it, because PDF extraction sometimes glues one on ("bell. tResidents").
    """
    return re.compile(rf"(?<!\d){re.escape(phrase)}(?!\d)")


def _search_ranges(start: int, end: int, last: int) -> list[tuple[int, int]]:
    """The cited pages, then one more on each side, then the whole report."""
    return [
        (max(low, 1), min(high, last))
        for low, high in ((start, end), (start - 1, end + 1), (1, last))
    ]


def _find_pages(
    quote: str,
    pages: Sequence[tuple[str, str]],
    pairs: Sequence[tuple[str, str]],
    start: int,
    end: int,
) -> tuple[int, int] | None:
    """Returns the page, or two adjacent pages, the quote is on, if any.

    Args:
        quote: The quote as the model gave it.
        pages: The variants of each page's text, page 1 first.
        pairs: The variants of each page's text joined to the next.
        start: The first page the quote cites.
        end: The last page the quote cites.
    """
    words = _normalise(quote)
    if not words:
        return None
    pattern = _not_inside_a_number(words)
    for low, high in _search_ranges(start, end, len(pages)):
        for page in range(low, high + 1):
            if any(pattern.search(text) for text in pages[page - 1]):
                return page, page
        for page in range(low, high):
            if any(pattern.search(text) for text in pairs[page - 1]):
                return page, page + 1
    return None


class Amenities(StrictModel):
    """The four required lists of unique supported categories."""

    care_types: list[CareTypesItem]
    room_types: list[RoomTypesItem]
    activities: list[ActivitiesItem]
    facilities: list[FacilitiesItem]

    @model_validator(mode="after")
    def unique_items(self) -> Self:
        """Reject repeated items and order categories and evidence."""
        for field, order in CATEGORY_ORDER.items():
            entries = cast(list[SelectedItem], getattr(self, field))
            if len({entry.item for entry in entries}) != len(entries):
                raise ValueError(f"Duplicate category in {field}")
            entries.sort(key=lambda entry: order.index(entry.item))
            for entry in entries:
                # Remove exact duplicates; keep distinct restriction passages.
                unique = {
                    (e.quote, e.page_start, e.page_end): e
                    for e in entry.evidence
                }
                entry.evidence = list(unique.values())
        return self

    def validate_pages(self, page_count: int) -> Self:
        """Reject evidence outside the original PDF page count."""
        for field in CATEGORY_ORDER:
            for entry in getattr(self, field):
                if any(e.page_end > page_count for e in entry.evidence):
                    raise ValueError(
                        "Evidence page range exceeds the source PDF"
                    )
        return self

    def verify_evidence(
        self, pages: Sequence[str]
    ) -> tuple[Self, EvidenceCheck]:
        """Keeps the evidence found in the report, at the pages it is on.

        Each quote is looked for in its cited pages, then one page more on
        each side, then the whole report, and takes the pages it is found
        on. Evidence found nowhere is dropped, and so is an item left with
        none.

        Args:
            pages: The text of each PDF page, page 1 first.

        Returns:
            The verified amenities, and what the check changed.
        """
        variants = [_page_variants(page) for page in pages]
        pairs = [
            _page_variants(_PAGE_FOOTER.sub("", first) + "\n" + second)
            for first, second in pairwise(pages)
        ]
        kept: dict[str, list[dict[str, object]]] = {}
        dropped: list[tuple[str, str, str]] = []
        items_dropped = evidence_corrected = evidence_dropped = 0
        for field in CATEGORY_ORDER:
            kept[field] = []
            for entry in cast(list[SelectedItem], getattr(self, field)):
                found: list[dict[str, object]] = []
                for evidence in entry.evidence:
                    location = _find_pages(
                        evidence.quote,
                        variants,
                        pairs,
                        evidence.page_start,
                        evidence.page_end,
                    )
                    if location is None:
                        evidence_dropped += 1
                        dropped.append((field, entry.item, evidence.quote))
                        continue
                    if location != (evidence.page_start, evidence.page_end):
                        evidence_corrected += 1
                    start, end = location
                    found.append(
                        {
                            "quote": evidence.quote,
                            "page_start": start,
                            "page_end": end,
                        }
                    )
                if found:
                    kept[field].append({"item": entry.item, "evidence": found})
                else:
                    items_dropped += 1
        return type(self).model_validate(kept), EvidenceCheck(
            items_kept=sum(len(entries) for entries in kept.values()),
            items_dropped=items_dropped,
            evidence_corrected=evidence_corrected,
            evidence_dropped=evidence_dropped,
            dropped=tuple(dropped),
        )


class AmenitiesResult(StrictModel):
    """The model response contains no generated provenance."""

    amenities: Amenities


class ExtractionFile(StrictModel):
    """Canonical extraction output with validated source metadata."""

    centre_id: str = Field(pattern=r"^[0-9]+$")
    inspection_date: str
    file_name: str = Field(min_length=1)
    hiqa_url: str
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    model: str = Field(min_length=1)
    extractor_version: Literal["amenities-v2"]
    extracted_at: AwareDatetime
    amenities: Amenities

    @model_validator(mode="after")
    def valid_provenance(self) -> Self:
        """Require a real inspection date, URI and UTC extraction time."""
        parsed = date.fromisoformat(self.inspection_date)
        if parsed.isoformat() != self.inspection_date:
            raise ValueError("inspection_date must use YYYY-MM-DD")
        if (
            not urlsplit(self.hiqa_url).scheme
            or not self.file_name.strip()
            or not self.model.strip()
        ):
            raise ValueError("Source URL, filename and model are required")
        offset = self.extracted_at.utcoffset()
        if offset is None or offset.total_seconds() != 0:
            raise ValueError("extracted_at must be UTC")
        return self
