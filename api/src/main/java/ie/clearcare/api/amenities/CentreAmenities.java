package ie.clearcare.api.amenities;

import java.time.LocalDate;
import java.util.List;

/**
 * What a centre offers residents: values a model (gpt-4o-mini) read from the whole text of one of
 * its inspection reports, with the report they came from. Provider text and inspector observations
 * are not separated yet. A flag is true or false when the report says so and null when it is
 * silent, which is not the same as the centre having none. inspection_date is null if the report
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
