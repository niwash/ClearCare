package ie.clearcare.api.centres;

/**
 * A centre as a search result lists it. The register fields are the columns of the
 * clearcare.centre_search view except centre_phone, which only CentreDetail has. The register's
 * provider name is left out, because some providers' names list individuals.
 *
 * <p>amenities is null when no report of the centre has been read yet, and latestInspection when
 * none has been loaded. fairDeal is true when a contract price is stored for the centre, which does
 * not show that the centre is on the newest HSE list. distanceM is how far the centre is from near,
 * in whole metres in a straight line, or null without near or when the centre has no point under
 * 30 days old.
 */
record CentreSummary(
    String centreId,
    String centreName,
    String address,
    String county,
    String eircode,
    Integer maximumOccupancy,
    String hiqaUrl,
    MentionedAmenities amenities,
    boolean fairDeal,
    LatestInspection latestInspection,
    Integer distanceM) {}
