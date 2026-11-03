package ie.clearcare.api.amenities;

/** Original PDF pages are counted from one, including cover and blank pages. */
record AmenityEvidence(String quote, int pageStart, int pageEnd) {}
