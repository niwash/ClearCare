package ie.clearcare.api.reports;

import java.time.Instant;

/** The stored PDF a report was read from: one download of it (ADR-0007). */
record ReportFile(Instant fetchedAt, String url, String sha256) {}
