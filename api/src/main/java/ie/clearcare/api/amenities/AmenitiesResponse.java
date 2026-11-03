package ie.clearcare.api.amenities;

/** The selected version's amenities, inside the unchanged response envelope. */
sealed interface AmenitiesResponse permits CentreAmenities, CentreAmenitiesV2 {}
