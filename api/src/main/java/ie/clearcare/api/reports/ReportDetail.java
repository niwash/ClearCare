package ie.clearcare.api.reports;

import java.time.LocalDate;
import java.util.List;

/**
 * One inspection report in full: the cover values the parser read, the stored PDF they came from,
 * and every record group the report printed.
 */
record ReportDetail(
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
    ReportFile reportFile,
    List<ReportInspector> inspectors,
    List<ReportRegulation> regulations,
    List<ReportComplianceItem> complianceItems) {}
