package ie.clearcare.api.amenities;

/**
 * A centre's amenities, as GET /centres/{centre_id}/amenities returns them. amenities is null when
 * none have been extracted for the centre yet. The controller turns a centre that the served
 * register snapshot does not have into 404, so this is never built for one.
 */
record CentreAmenitiesResult(String centreId, CentreAmenities amenities) {}
