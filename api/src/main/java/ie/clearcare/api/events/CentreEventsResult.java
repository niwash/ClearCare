package ie.clearcare.api.events;

import java.util.List;

/**
 * A centre's events, newest first, as GET /centres/{centre_id}/events returns them. events is null
 * when the served register snapshot does not have the centre, which the controller turns into 404.
 */
record CentreEventsResult(String centreId, List<CentreEvent> events) {}
