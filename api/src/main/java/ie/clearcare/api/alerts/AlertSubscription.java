package ie.clearcare.api.alerts;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * One thing an account asked to be told about (db/V26, ADR-0034).
 *
 * <p>{@code metadata} names what it is about: {@code centre_id} for a home, {@code county_id} for a
 * county, and an empty document for everything. {@code label} is what the site shows: the home's
 * current name, the county's name, or the package's own name. It is resolved when the row is read,
 * because the register renames a home and a county is stored as an id.
 */
public record AlertSubscription(
    long id,
    String scope,
    String label,
    Map<String, Object> metadata,
    boolean active,
    OffsetDateTime created_at) {}
