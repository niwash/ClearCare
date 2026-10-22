package ie.clearcare.api.reports;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * The scalar columns of one report, as clearcare.centre_report has them. The repository reads a row
 * into this, then adds the record groups the report printed to make a ReportDetail.
 */
record ReportHeader(
    long reportId,
    String centreId,
    String centreCode,
    String centreName,
    String providerName,
    String address,
    String inspectionType,
    LocalDate inspectionDate,
    String fieldworkId,
    Integer residents,
    String reportSha256,
    String reportUrl,
    OffsetDateTime reportFetchedAt) {}
