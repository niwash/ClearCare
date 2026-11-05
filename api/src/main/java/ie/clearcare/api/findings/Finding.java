package ie.clearcare.api.findings;

import java.time.LocalDate;
import java.util.List;

/**
 * One finding of a report, with the report text about it and its re-assessment (ADR-0024).
 * inspector and providerResponse are null when that text was not extracted at the served
 * version; statedDeadlines is null when there is no response or it was not split at the served
 * version.
 */
record Finding(
    long reportId,
    LocalDate inspectionDate,
    String reportUrl,
    String regulation,
    String title,
    String judgment,
    List<FindingComplianceItem> complianceItems,
    ReportText inspector,
    ReportText providerResponse,
    List<StatedDeadline> statedDeadlines,
    ReAssessment reAssessment) {}
