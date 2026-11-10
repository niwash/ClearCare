package ie.clearcare.api.centres;

/**
 * A centre as a pin on the search page's map: enough of its register entry to label the pin, and
 * its point from clearcare.centre_point in degrees on WGS 84, as stored. distanceM is as in
 * CentreSummary, and null without near.
 *
 * <p>The coordinates are Google's, so only GET /centres/points gives them, and only to the site
 * (ADR-0029).
 */
record CentrePoint(
    String centreId,
    String centreName,
    String address,
    String county,
    double latitude,
    double longitude,
    Integer distanceM) {}
