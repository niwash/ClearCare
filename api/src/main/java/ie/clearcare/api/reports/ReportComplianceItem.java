package ie.clearcare.api.reports;

import java.time.LocalDate;

/** One item of a report's compliance plan: what must change, how serious it is, and by when. */
record ReportComplianceItem(
    String regulation,
    String requirement,
    String judgment,
    String riskRating,
    LocalDate dateToComply) {}
