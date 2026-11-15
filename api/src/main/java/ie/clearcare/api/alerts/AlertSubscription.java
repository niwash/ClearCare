package ie.clearcare.api.alerts;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * One thing an account asked to be told about (db/V26, ADR-0034).
 *
 * <p>{@code label} is what the site shows: the home's name for a facility, the county's name for a
 * county, the package's own name for everything. It is resolved when the row is read, because the
 * register renames a home and a county is stored as an id.
 */
public record AlertSubscription(
    long id,
    String scope,
    String label,
    Map<String, Object> context,
    boolean active,
    OffsetDateTime created_at) {}
