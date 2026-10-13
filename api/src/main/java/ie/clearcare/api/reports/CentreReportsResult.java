package ie.clearcare.api.reports;

import java.util.List;

/**
 * A centre's inspection reports, as GET /centres/{centre_id}/reports returns them. reports is null
 * when the served register snapshot does not have the centre, which the controller turns into 404.
 */
record CentreReportsResult(String centreId, List<CentreReport> reports) {}
