package ie.clearcare.api.reports;

import java.time.LocalDate;
import java.time.LocalTime;

/** An inspector named on a report, with the day and times they attended. */
record ReportInspector(
    LocalDate date, LocalTime startTime, LocalTime endTime, String name, String role) {}
