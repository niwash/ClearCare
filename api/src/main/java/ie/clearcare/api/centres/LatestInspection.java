package ie.clearcare.api.centres;

import java.time.LocalDate;

/** A centre's newest loaded inspection report. date is null when the report gives none. */
record LatestInspection(LocalDate date) {}
