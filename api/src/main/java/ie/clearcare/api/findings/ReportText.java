package ie.clearcare.api.findings;

/** A passage of a report as extracted (db/V5), with the PDF pages it spans. */
record ReportText(String text, int firstPage, int lastPage) {}
