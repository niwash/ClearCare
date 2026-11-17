package ie.clearcare.api.centres;

/**
 * One extra condition of a centre's registration in the served register snapshot: its number on
 * the register and HIQA's words.
 */
record ExtraCondition(int number, String text) {}
