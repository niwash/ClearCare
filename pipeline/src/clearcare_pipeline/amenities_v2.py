"""Approved amenities-v2 structured output and extraction-file validation."""

from datetime import date
from typing import Literal, Self, cast
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

    quote: str = Field(min_length=1)
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


CATEGORY_ORDER = {
    "care_types": [
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
    ],
    "room_types": [
        "Single room",
        "Twin/double room",
        "Multi-bed room",
        "Shared room, occupancy unspecified",
        "En-suite facilities",
        "Shared bathroom facilities",
    ],
    "activities": [
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
    ],
    "facilities": [
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
    ],
}


SelectedItem = CareTypesItem | RoomTypesItem | ActivitiesItem | FacilitiesItem


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
