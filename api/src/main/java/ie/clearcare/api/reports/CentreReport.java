package ie.clearcare.api.reports;

import java.time.LocalDate;

/**
 * One inspection report of a centre, as the centre's page lists it: enough to choose one, and how
 * much it holds. GET /reports/{report_id} returns the report itself.
 */
record CentreReport(
    long reportId,
    String inspectionType,
    LocalDate inspectionDate,
    String fieldworkId,
    Integer residents,
    long inspectorCount,
    long regulationCount,
    long complianceItemCount) {}
