package ie.clearcare.api.alerts;

import java.time.OffsetDateTime;

/**
 * One target an account follows, as the API returns it (api/openapi.yaml): the package and the
 * single target inside it. A centre row carries {@code centreId} and a null county; a county row
 * the reverse; the all-reports row has both null.
 *
 * <p>The target fields are read out of the subscription's jsonb metadata, which holds one object
 * shaped by the package's scope (ADR-0034). The API writes that object and this record reads it
 * back, so the site never has to parse metadata itself.
 */
public record AlertSubscription(
    long id,
    int packageId,
    String title,
    String description,
    String scope,
    String centreId,
    Integer countyId,
    OffsetDateTime createdAt) {}
