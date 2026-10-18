package ie.clearcare.api.statistics;

/**
 * Of the judgments of one starting judgment that have a later report, how many the next report
 * judged again. rate is null when none has a later report.
 */
record ReCheckRate(String judgment, long withLaterReport, long reAssessed, Double rate) {

  static ReCheckRate from(NextResultCounts counts) {
    long withLaterReport = counts.total() - counts.noLaterReport();
    long reAssessed = counts.compliant() + counts.substantiallyCompliant() + counts.notCompliant();
    Double rate = withLaterReport == 0 ? null : (double) reAssessed / withLaterReport;
    return new ReCheckRate(counts.judgment(), withLaterReport, reAssessed, rate);
  }
}
