package ie.clearcare.api.centres;

/**
 * One centre as GET /centres/{centre_id} returns it: the fields of a search result and the centre's
 * phone number, which search results leave out. The phone is as the register prints it, and null
 * when the register gave none or the snapshot was loaded before db/V7.
 */
record CentreDetail(
    String centreId,
    String centreName,
    String address,
    String county,
    String eircode,
    Integer maximumOccupancy,
    String hiqaUrl,
    String centrePhone) {}
