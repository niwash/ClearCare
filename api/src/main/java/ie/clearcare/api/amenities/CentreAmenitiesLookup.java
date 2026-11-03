package ie.clearcare.api.amenities;

/**
 * What the repository found for a centre. centreFound is false if the served register snapshot does
 * not have the centre, and amenities is null if it has the centre but nothing has been extracted
 * for it yet.
 */
record CentreAmenitiesLookup(boolean centreFound, CentreAmenities amenities) {}
