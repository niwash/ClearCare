package ie.clearcare.api.alerts;

/**
 * A target to follow, as {@code POST /alerts/subscriptions} takes it (api/openapi.yaml). The
 * package's scope decides which target field is sent: {@code CENTRE} takes {@code centreId},
 * {@code COUNTY} takes {@code countyId}, and {@code ALL} takes neither.
 *
 * <p>No validation lives here, because a field is only right or wrong next to the package it is for:
 * the repository reads the package's scope and refuses a mismatch before writing anything.
 */
public record AlertSubscriptionRequest(Integer packageId, String centreId, Integer countyId) {}
