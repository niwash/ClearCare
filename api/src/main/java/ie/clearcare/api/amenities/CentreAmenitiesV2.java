package ie.clearcare.api.amenities;

import java.time.LocalDate;
import java.util.List;

/** V2 retains each approved category's evidence and the existing report provenance. */
record CentreAmenitiesV2(
    long reportId,
    LocalDate inspectionDate,
    List<AmenityItem> careTypes,
    List<AmenityItem> roomTypes,
    List<AmenityItem> activities,
    List<AmenityItem> facilities,
    String extractorVersion,
    String model) implements AmenitiesResponse {}
