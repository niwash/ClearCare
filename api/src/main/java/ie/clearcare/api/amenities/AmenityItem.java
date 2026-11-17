package ie.clearcare.api.amenities;

import java.util.List;

/** One selected category and all of its distinct supporting passages. */
record AmenityItem(String item, List<AmenityEvidence> evidence) {}
