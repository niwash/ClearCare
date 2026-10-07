package ie.clearcare.api.centres;

/** One centre, and the register snapshot it was read from. */
record CentreResult(Centre centre, RegisterSnapshot registerSnapshot) {}
