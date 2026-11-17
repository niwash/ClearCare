package ie.clearcare.api.centres;

import java.time.LocalDate;
import java.util.List;

/**
 * The items a centre's latest extracted report mentions, as GET
 * /centres/{centre_id}/amenities?version=amenities-v2 serves them but without the evidence. An item
 * that is missing is not confirmed absent. inspectionDate is that report's date, which can be older
 * than the centre's latest inspection, and is null if the report printed none.
 */
record MentionedAmenities(
    long reportId,
    LocalDate inspectionDate,
    List<String> careTypes,
    List<String> roomTypes,
    List<String> activities,
    List<String> facilities) {}
