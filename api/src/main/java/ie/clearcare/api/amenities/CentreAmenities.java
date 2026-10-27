package ie.clearcare.api.amenities;

import java.time.LocalDate;
import java.util.List;

/**
 * What a centre offers residents, as read from one of its inspection reports. The lists hold the
 * report's own wording. A flag is true when the report mentions the amenity and null when it does
 * not, which is not the same as the centre having none. inspection_date is null if the report
 * printed none.
 */
record CentreAmenities(
    long reportId,
    LocalDate inspectionDate,
    List<String> careTypes,
    List<String> roomTypes,
    Boolean hasOutdoorSpace,
    List<String> activities,
    Boolean hasTransport,
    Boolean hasChapelOrReligiousServices,
    List<String> specialUnits,
    String diningNotes,
    String otherNotes,
    String extractorVersion,
    String model) {}
