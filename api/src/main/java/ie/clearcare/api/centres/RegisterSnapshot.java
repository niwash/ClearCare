package ie.clearcare.api.centres;

import java.time.Instant;

/** Where the published register snapshot came from: one download of the HIQA register. */
record RegisterSnapshot(Instant fetchedAt, String url, String sha256) {}
