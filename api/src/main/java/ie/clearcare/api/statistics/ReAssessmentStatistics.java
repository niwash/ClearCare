package ie.clearcare.api.statistics;

import java.time.LocalDate;
import java.util.List;

/**
 * What each judgment became at the centre's next report, nationally, as GET
 * /statistics/re-assessment returns it. The matrix and the re-check rates have one row per starting
 * judgment: Compliant, Substantially compliant, Not compliant.
 */
record ReAssessmentStatistics(
    List<NextResultCounts> matrix,
    List<ReCheckRate> reCheckRate,
    Coverage coverage,
    LocalDate dataDate) {}
