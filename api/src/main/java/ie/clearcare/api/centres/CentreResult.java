package ie.clearcare.api.centres;

/** One centre, and the register snapshot it was read from. */
record CentreResult(CentreDetail centre, RegisterSnapshot registerSnapshot) {}
