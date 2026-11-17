package ie.clearcare.api.findings;

import java.time.LocalDate;

/** A commitment of a provider's response with the deadline it states (db/V6, ADR-0017). */
record StatedDeadline(
    String text,
    LocalDate statedDeadline,
    String statedDeadlineText,
    String deadlinePrecision,
    int page,
    int lastPage) {}
