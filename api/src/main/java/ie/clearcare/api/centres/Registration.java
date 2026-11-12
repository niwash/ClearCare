package ie.clearcare.api.centres;

import java.time.LocalDate;

/** A centre's registration in the served register snapshot, as the register prints its dates. */
record Registration(LocalDate registeredFrom, LocalDate registeredUntil) {}
