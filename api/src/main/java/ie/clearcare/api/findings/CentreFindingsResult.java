package ie.clearcare.api.findings;

import java.util.List;

/**
 * A centre's findings, as GET /centres/{centre_id}/findings returns them. findings is null when
 * the served register snapshot does not have the centre, which the controller turns into 404.
 */
record CentreFindingsResult(String centreId, List<Finding> findings) {}
