package ie.clearcare.api.amenities;

import java.util.List;

/** The four-list JSON value stored in the v2 read view. */
record AmenitiesV2Lists(
    List<AmenityItem> careTypes,
    List<AmenityItem> roomTypes,
    List<AmenityItem> activities,
    List<AmenityItem> facilities) {}
