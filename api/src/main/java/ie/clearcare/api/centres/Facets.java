package ie.clearcare.api.centres;

import java.util.Map;

/**
 * For every item of every amenities-v2 list, how many centres would match if that item were also
 * given, with the other parameters as they are; and how many of the matching centres have a stored
 * contract price. Every item is a key, those that match no centre with 0.
 */
record Facets(
    Map<String, Long> careType,
    Map<String, Long> roomType,
    Map<String, Long> facility,
    Map<String, Long> activity,
    long fairDeal) {}
