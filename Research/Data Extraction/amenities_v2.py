"""Use the pipeline's shared v2 contract from the standalone extractor."""

import sys
from pathlib import Path

# The research entry point also works from an uninstalled source checkout.
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "pipeline" / "src"))

from clearcare_pipeline.amenities_v2 import (  # noqa: E402, F401
    CATEGORY_ORDER,
    Amenities,
    AmenitiesResult,
    ExtractionFile,
)
