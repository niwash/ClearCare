package ie.clearcare.api.reports;

/** A regulation a report considered, as Appendix 1 lists it: its number and title, and judgment. */
record ReportRegulation(String regulation, String title, String judgment) {}
