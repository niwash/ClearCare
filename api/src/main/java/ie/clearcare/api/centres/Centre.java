package ie.clearcare.api.centres;

/**
 * A centre's entry in the published register snapshot, with the columns of the
 * clearcare.centre_search view. The register's provider name is left out, because some providers'
 * names list individuals.
 */
record Centre(
    String centreId,
    String centreName,
    String address,
    String county,
    String eircode,
    Integer maximumOccupancy,
    String hiqaUrl) {}
