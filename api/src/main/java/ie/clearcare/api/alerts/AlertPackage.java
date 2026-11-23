package ie.clearcare.api.alerts;

/**
 * One package the site may offer, as {@code GET /alerts/packages} returns it (api/openapi.yaml,
 * CCARE-271): what it is called, what it does, and the scope that decides which target a
 * subscription to it carries.
 *
 * <p>The id is the database's, from an identity column, so the site reads it here rather than
 * assuming the seed's order. A database whose sequence has moved on (a re-run migration, a restored
 * dump) numbers the packages differently, and a site that sent a fixed id would be refused with
 * "package_id must name an active alert package".
 */
public record AlertPackage(long id, String title, String description, String scope) {}
