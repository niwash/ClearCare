package ie.clearcare.api.centres;

/**
 * One centre as GET /centres/{centre_id} returns it: the register fields and the centre's phone
 * number, which search results leave out. The phone is as the register prints it, and null when
 * the register gave none or the snapshot was loaded before db/V7.
 *
 * <p>placeId is the Google listing the centre's photo comes from (CCARE-209, ADR-0030), and null
 * when no listing was matched for it. The page renders the photo from it through Google's Places UI
 * Kit; nothing of Google's is stored. Null also on an API without db/V19.
 */
record CentreDetail(
    String centreId,
    String centreName,
    String address,
    String county,
    String eircode,
    Integer maximumOccupancy,
    String hiqaUrl,
    String centrePhone,
    String placeId) {}
