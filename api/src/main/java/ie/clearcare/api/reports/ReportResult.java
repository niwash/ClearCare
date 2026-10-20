package ie.clearcare.api.reports;

/** One report in full, as GET /reports/{report_id} returns it. */
record ReportResult(ReportDetail report) {}
