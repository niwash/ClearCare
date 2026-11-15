package ie.clearcare.api.alerts;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalInt;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The alert tables of db/V26 (ADR-0034): the catalogue of packages, one account's subscriptions, and
 * the label each row is shown with.
 *
 * <p>The API is the only writer of a subscription. It never reads an event or a notification, which
 * is why it holds no grant on those tables.
 */
@Repository
class AlertRepository {

  // The same upsert as the saved search: an account row is made the first time the site writes
  // anything for it, and DO UPDATE is what RETURNING needs to give back the id.
  private static final String ACCOUNT =
      """
      INSERT INTO clearcare.users (cognito_sub) VALUES (:sub)
      ON CONFLICT (cognito_sub) DO UPDATE SET cognito_sub = EXCLUDED.cognito_sub
      RETURNING id
      """;

  private static final String PACKAGE =
      """
      SELECT id, name, context_schema
      FROM clearcare.alert_packages
      WHERE scope = :scope AND is_active
      """;

  // A subscription is shown with what it is about rather than with its context: the home's current
  // name from the register, the county's name from clearcare.county, or the package's own name for
  // everything. The names are read here so a rename in the register reads through.
  private static final String SELECT =
      """
      SELECT s.id, s.context, s.is_active, s.created_at, p.scope,
             CASE p.scope
               WHEN 'FACILITY' THEN COALESCE(
                 (SELECT c.centre_name FROM clearcare.centre_search c
                  WHERE c.centre_id = s.context ->> 'centre_id'
                  ORDER BY c.centre_name LIMIT 1),
                 p.name)
               WHEN 'COUNTY' THEN COALESCE(
                 (SELECT co.name FROM clearcare.county co
                  WHERE co.id = (s.context ->> 'county_id')::int),
                 p.name)
               ELSE p.name
             END AS label
      FROM clearcare.alert_subscriptions s
      JOIN clearcare.alert_packages p ON p.id = s.alert_package_id
      """;

  private static final String LIST =
      SELECT
          + """
           JOIN clearcare.users u ON u.id = s.user_id
           WHERE u.cognito_sub = :sub AND s.is_active
           ORDER BY s.created_at, s.id
           """;

  private static final String ONE = SELECT + " WHERE s.id = :id";

  // Asking again for the same thing is the same subscription: the natural key is what keeps it one
  // row, and reactivating the row it had keeps the notifications under it readable.
  private static final String SUBSCRIBE =
      """
      INSERT INTO clearcare.alert_subscriptions (user_id, alert_package_id, context)
      VALUES (:user, :package, CAST(:context AS jsonb))
      ON CONFLICT (user_id, alert_package_id, context)
      DO UPDATE SET is_active = TRUE, deactivated_at = NULL
      RETURNING id
      """;

  private static final String STOP =
      """
      UPDATE clearcare.alert_subscriptions
      SET is_active = FALSE, deactivated_at = now()
      WHERE id = :id AND is_active
        AND user_id = (SELECT id FROM clearcare.users WHERE cognito_sub = :sub)
      """;

  private static final String STOP_ALL =
      """
      UPDATE clearcare.alert_subscriptions
      SET is_active = FALSE, deactivated_at = now()
      WHERE is_active
        AND user_id = (SELECT id FROM clearcare.users WHERE cognito_sub = :sub)
      """;

  private static final String CENTRE =
      "SELECT 1 FROM clearcare.centre_search WHERE centre_id = :id LIMIT 1";

  private static final String COUNTY = "SELECT id FROM clearcare.county WHERE lower(name) = lower(:name)";

  private final JdbcClient jdbc;
  private final JsonMapper json;

  AlertRepository(JdbcClient jdbc, JsonMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  /** What this account is subscribed to now, oldest first. */
  List<AlertSubscription> list(String cognitoSub) {
    return jdbc.sql(LIST).param("sub", cognitoSub).query(this::subscription).list();
  }

  /**
   * Subscribes the account to one thing, or reactivates the row it already had, and answers with what
   * is stored.
   *
   * <p>The account row and the subscription commit together, and the context is checked against the
   * package's own schema before either is written.
   */
  @Transactional
  AlertSubscription subscribe(String cognitoSub, String scope, Map<String, Object> context) {
    Package chosen =
        jdbc
            .sql(PACKAGE)
            .param("scope", scope)
            .query(this::packageRow)
            .optional()
            .orElseThrow(AlertRepository::noSuchPackage);
    AlertContexts.check(chosen.schema(), context);

    long userId = jdbc.sql(ACCOUNT).param("sub", cognitoSub).query(Long.class).single();
    long id =
        jdbc
            .sql(SUBSCRIBE)
            .param("user", userId)
            .param("package", chosen.id())
            .param("context", json.writeValueAsString(context))
            .query(Long.class)
            .single();
    return find(id).orElseThrow();
  }

  /** Stops one subscription of this account. False when the account has no live row with that id. */
  boolean stop(String cognitoSub, long id) {
    return jdbc.sql(STOP).param("id", id).param("sub", cognitoSub).update() > 0;
  }

  /** Stops everything this account is subscribed to, including a link that arrives twice. */
  void stopAll(String cognitoSub) {
    jdbc.sql(STOP_ALL).param("sub", cognitoSub).update();
  }

  boolean centreExists(String centreId) {
    return jdbc.sql(CENTRE).param("id", centreId).query(Integer.class).optional().isPresent();
  }

  OptionalInt countyId(String name) {
    Optional<Integer> id = jdbc.sql(COUNTY).param("name", name).query(Integer.class).optional();
    return id.isPresent() ? OptionalInt.of(id.get()) : OptionalInt.empty();
  }

  private Optional<AlertSubscription> find(long id) {
    return jdbc.sql(ONE).param("id", id).query(this::subscription).optional();
  }

  private AlertSubscription subscription(ResultSet row, int rowNumber) throws SQLException {
    return new AlertSubscription(
        row.getLong("id"),
        row.getString("scope"),
        row.getString("label"),
        context(row.getString("context")),
        row.getBoolean("is_active"),
        row.getObject("created_at", OffsetDateTime.class));
  }

  private Map<String, Object> context(String document) {
    JsonNode node = json.readTree(document);
    Map<String, Object> values = new LinkedHashMap<>();
    node.properties().forEach(entry -> values.put(entry.getKey(), value(entry.getValue())));
    return values;
  }

  private Object value(JsonNode node) {
    if (node.isIntegralNumber()) {
      return node.asInt();
    }
    if (node.isNumber()) {
      return node.asDouble();
    }
    return node.asString();
  }

  private Package packageRow(ResultSet row, int rowNumber) throws SQLException {
    return new Package(
        row.getInt("id"), row.getString("name"), json.readTree(row.getString("context_schema")));
  }

  private static org.springframework.web.server.ResponseStatusException noSuchPackage() {
    return new org.springframework.web.server.ResponseStatusException(
        org.springframework.http.HttpStatus.NOT_FOUND, "There is no such kind of alert.");
  }

  private record Package(int id, String name, JsonNode schema) {}
}
