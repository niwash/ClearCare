"""The API contract names the same amenities-v2 items as the extractor."""

from pathlib import Path

import yaml

from clearcare_pipeline.amenities_v2 import CATEGORY_ORDER

CONTRACT = Path(__file__).resolve().parents[2] / "api" / "openapi.yaml"

# The schema in the contract that lists each list's item names.
SCHEMAS = {
    "care_types": "CareTypeItem",
    "room_types": "RoomTypeItem",
    "activities": "ActivityItem",
    "facilities": "FacilityItem",
}


def test_the_contract_names_the_extractor_items_in_order() -> None:
    contract = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    schemas = contract["components"]["schemas"]
    assert {
        field: schemas[schema]["enum"] for field, schema in SCHEMAS.items()
    } == CATEGORY_ORDER
