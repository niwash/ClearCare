package ie.clearcare.api.findings;

import java.time.LocalDate;

/**
 * When a finding's regulation was next judged, as clearcare.finding_re_assessment has it
 * (db/V14). Everything but status is null unless status is "re-assessed".
 */
record ReAssessment(
    String status,
    Long reportId,
    LocalDate inspectionDate,
    String reportUrl,
    String judgment,
    Long reportsBetween,
    ReportText inspector) {}
