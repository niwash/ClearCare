package ie.clearcare.api.reports;

import java.time.Instant;
import java.util.List;

/**
 * A centre's inspection reports, as GET /centres/{centre_id}/reports returns them. reports is null
 * when the served register snapshot does not have the centre, which the controller turns into 404.
 * hiqaCheckedAt is when ClearCare last read the centre's page on hiqa.ie (db/V18), or null if it
 * has not yet.
 */
record CentreReportsResult(String centreId, List<CentreReport> reports, Instant hiqaCheckedAt) {}
