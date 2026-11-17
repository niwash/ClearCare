package ie.clearcare.api.centres;

import java.util.List;

/**
 * The point of every matching centre that has one, in name order, and the register snapshot the
 * centres were read from.
 */
record CentrePointsResult(List<CentrePoint> points, RegisterSnapshot registerSnapshot) {}
