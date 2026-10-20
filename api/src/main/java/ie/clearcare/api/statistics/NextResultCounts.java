package ie.clearcare.api.statistics;

/**
 * How many judgments of one starting judgment had each next_result (db/V4): one of the three
 * judgments, not re-assessed, or no later report.
 */
record NextResultCounts(
    String judgment,
    long compliant,
    long substantiallyCompliant,
    long notCompliant,
    long notReAssessed,
    long noLaterReport,
    long total) {}
