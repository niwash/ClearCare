package ie.clearcare.api.alerts;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.json.JsonMapper;

/**
 * The alerts tables the API writes (db/V26, ADR-0034): the account's subscriptions, read back with
 * their package, and the capability that lets an email link unsubscribe the account.
 *
 * <p>The account is named by its Cognito subject and resolved to the number these tables key on;
 * the browser never supplies that number. A subscription's target lives in the metadata jsonb as
 * one object shaped by the package's scope, written here and read back for every response, so the
 * site never parses it.
 *
 * <p>Cancel, cancel-all and unsubscribe delete rows rather than setting {@code is_active}
 * (ADR-0034): the partial unique index then lets the same target be followed again later, and the
 * notification history is left alone.
 */
@Repository
class AlertSubscriptionRepository {

  private static final String LIST =
      """
      SELECT s.id, s.alert_package_id, p.title, p.description, p.scope,
             s.metadata -> 0 ->> 'centre_id' AS centre_id,
             (s.metadata -> 0 ->> 'county_id')::int AS county_id,
             s.created_at
      FROM clearcare.alert_subscriptions s
      JOIN clearcare.alert_packages p ON p.id = s.alert_package_id
      JOIN clearcare.users u ON u.id = s.user_id
      WHERE u.cognito_sub = :sub AND s.is_active
      ORDER BY s.created_at DESC, s.id DESC
      """;

  private static final String FIND =
      """
      SELECT s.id, s.alert_package_id, p.title, p.description, p.scope,
             s.metadata -> 0 ->> 'centre_id' AS centre_id,
             (s.metadata -> 0 ->> 'county_id')::int AS county_id,
             s.created_at
      FROM clearcare.alert_subscriptions s
      JOIN clearcare.alert_packages p ON p.id = s.alert_package_id
      JOIN clearcare.users u ON u.id = s.user_id
      WHERE u.cognito_sub = :sub AND s.is_active AND s.id = :id
      """;

  private static final String PACKAGE =
      """
      SELECT id, scope, is_active
      FROM clearcare.alert_packages
      WHERE id = :id
      """;

  // What the site offers (CCARE-271), in the seed's order. The ids are the database's, so the site
  // reads them rather than assuming 1, 2 and 3.
  private static final String PACKAGES =
      """
      SELECT id, title, description, scope
      FROM clearcare.alert_packages
      WHERE is_active
      ORDER BY id
      """;

  private static final String CENTRE =
      "SELECT 1 FROM clearcare.centre WHERE centre_id = :id";
  private static final String COUNTY = "SELECT 1 FROM clearcare.county WHERE id = :id";

  // The account row is created the first time this account follows anything, and left alone after
  // that; the same write as the saved search's (db/V15).
  private static final String ACCOUNT =
      """
      INSERT INTO clearcare.users (cognito_sub) VALUES (:sub)
      ON CONFLICT (cognito_sub) DO UPDATE SET cognito_sub = EXCLUDED.cognito_sub
      RETURNING id
      """;

  // A double click, or a request retried by the site, finds the unique index and keeps one row.
  private static final String INSERT =
      """
      INSERT INTO clearcare.alert_subscriptions (user_id, alert_package_id, metadata)
      VALUES (:user, :package, CAST(:metadata AS jsonb))
      ON CONFLICT (user_id, alert_package_id, metadata) WHERE is_active DO NOTHING
      RETURNING id
      """;

  private static final String EXISTING =
      """
      SELECT id FROM clearcare.alert_subscriptions
      WHERE user_id = :user AND alert_package_id = :package
        AND metadata = CAST(:metadata AS jsonb) AND is_active
      """;

  private static final String CANCEL =
      """
      DELETE FROM clearcare.alert_subscriptions s
      USING clearcare.users u
      WHERE s.user_id = u.id AND u.cognito_sub = :sub AND s.id = :id
      """;

  private static final String CANCEL_SUB_ALL =
      """
      DELETE FROM clearcare.alert_subscriptions s
      USING clearcare.users u
      WHERE s.user_id = u.id AND u.cognito_sub = :sub
      """;

  private static final String TOKEN_ACCOUNT =
      "SELECT user_id FROM clearcare.alert_unsubscribe WHERE token = :token";

  private static final String CANCEL_ALL =
      "DELETE FROM clearcare.alert_subscriptions WHERE user_id = :user";

  // A centre id on the register is numeric (db/V1); the cap leaves room for a longer one without
  // letting a caller write a string that is mostly length.
  private static final Pattern CENTRE_ID = Pattern.compile("[0-9]{1,10}");

  private final JdbcClient jdbc;
  private final JsonMapper json;

  AlertSubscriptionRepository(JdbcClient jdbc, JsonMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  /** The account's active subscriptions, newest first. An account with none gets an empty list. */
  List<AlertSubscription> list(String cognitoSub) {
    return jdbc.sql(LIST).param("sub", cognitoSub).query(this::subscription).list();
  }

  /**
   * The packages the site may offer, with their ids, in the seed's order.
   *
   * <p>The site sends a package id on every subscription it adds, so it has to be told which ids
   * this database holds: an identity column can be ahead of the seed's order, and a site that
   * assumed the order would be refused with "package_id must name an active alert package".
   */
  List<AlertPackage> packages() {
    return jdbc
        .sql(PACKAGES)
        .query(
            (rs, row) ->
                new AlertPackage(
                    rs.getLong("id"),
                    rs.getString("title"),
                    rs.getString("description"),
                    rs.getString("scope")))
        .list();
  }

  /**
   * Adds the target the package's scope names, and returns the row as stored.
   *
   * <p>A package that is unknown or switched off, a target the scope does not take, and a centre or
   * county the register does not hold are all client mistakes, refused with 400 before anything is
   * written. A row that already exists is returned instead of a second one.
   */
  @Transactional
  AlertSubscription subscribe(String cognitoSub, AlertSubscriptionRequest request) {
    Package pack = activePackage(request.packageId());
    checkTarget(pack.scope(), request);
    long userId = account(cognitoSub);
    long id = insertOrExisting(userId, pack.id(), metadata(pack.scope(), request));
    return find(cognitoSub, id)
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "The subscription was not stored."));
  }

  /** Deletes one of the account's subscriptions. Another account's id, or a gone one, changes nothing. */
  void cancel(String cognitoSub, long id) {
    jdbc.sql(CANCEL).param("sub", cognitoSub).param("id", id).update();
  }

  /**
   * Deletes every subscription of the account, named by its subject.
   *
   * <p>The site's way to stop all alerts without the email's link, used when the visitor cancels the
   * every-report alert: that is the broadest thing they can ask for, so cancelling it leaves nothing
   * to send. A subject with no rows, or no account at all, changes nothing.
   */
  void cancelAll(String cognitoSub) {
    jdbc.sql(CANCEL_SUB_ALL).param("sub", cognitoSub).update();
  }

  /**
   * Deletes every subscription of the account the token belongs to.
   *
   * <p>A token no account holds is a 404; a valid token that already cancelled everything answers
   * the same 204 as the first call, so a reloaded page is not an error.
   */
  @Transactional
  void unsubscribe(String token) {
    Optional<Long> account =
        token == null || token.isBlank()
            ? Optional.empty()
            : jdbc.sql(TOKEN_ACCOUNT).param("token", token).query(Long.class).optional();
    long userId =
        account.orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "This unsubscribe link is not valid."));
    jdbc.sql(CANCEL_ALL).param("user", userId).update();
  }

  private Package activePackage(Integer packageId) {
    if (packageId == null) {
      throw refused("package_id is required");
    }
    return jdbc
        .sql(PACKAGE)
        .param("id", packageId)
        .query(this::packageRow)
        .optional()
        .filter(Package::active)
        .orElseThrow(() -> refused("package_id must name an active alert package"));
  }

  private void checkTarget(String scope, AlertSubscriptionRequest request) {
    switch (scope) {
      case "CENTRE" -> {
        if (request.centreId() == null || request.countyId() != null) {
          throw refused("a CENTRE package takes centre_id and no county_id");
        }
        if (!CENTRE_ID.matcher(request.centreId()).matches()) {
          throw refused("centre_id must be digits");
        }
        if (jdbc
            .sql(CENTRE)
            .param("id", request.centreId())
            .query(Integer.class)
            .optional()
            .isEmpty()) {
          throw refused("no centre with that id");
        }
      }
      case "COUNTY" -> {
        if (request.countyId() == null || request.centreId() != null) {
          throw refused("a COUNTY package takes county_id and no centre_id");
        }
        if (jdbc.sql(COUNTY).param("id", request.countyId()).query(Integer.class).optional().isEmpty()) {
          throw refused("no county with that id");
        }
      }
      case "ALL" -> {
        if (request.centreId() != null || request.countyId() != null) {
          throw refused("an ALL package takes no centre_id or county_id");
        }
      }
      default -> throw refused("the package has an unknown scope");
    }
  }

  private String metadata(String scope, AlertSubscriptionRequest request) {
    return switch (scope) {
      case "CENTRE" -> json.writeValueAsString(List.of(Map.of("centre_id", request.centreId())));
      case "COUNTY" -> json.writeValueAsString(List.of(Map.of("county_id", request.countyId())));
      case "ALL" -> "[]";
      default -> throw refused("the package has an unknown scope");
    };
  }

  private long account(String cognitoSub) {
    return jdbc.sql(ACCOUNT).param("sub", cognitoSub).query(Long.class).single();
  }

  private long insertOrExisting(long userId, int packageId, String metadata) {
    try {
      return jdbc
          .sql(INSERT)
          .param("user", userId)
          .param("package", packageId)
          .param("metadata", metadata)
          .query(Long.class)
          .optional()
          .orElseGet(() -> existing(userId, packageId, metadata));
    } catch (DataIntegrityViolationException refused) {
      // The FKs the subscription carries (the account and the package) are checked above; a race
      // that slips through is still a client mistake, not a server error.
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "the subscription could not be saved", refused);
    }
  }

  private long existing(long userId, int packageId, String metadata) {
    return jdbc
        .sql(EXISTING)
        .param("user", userId)
        .param("package", packageId)
        .param("metadata", metadata)
        .query(Long.class)
        .single();
  }

  private Optional<AlertSubscription> find(String cognitoSub, long id) {
    return jdbc
        .sql(FIND)
        .param("sub", cognitoSub)
        .param("id", id)
        .query(this::subscription)
        .optional();
  }

  private Package packageRow(ResultSet row, int rowNumber) throws SQLException {
    return new Package(row.getInt("id"), row.getString("scope"), row.getBoolean("is_active"));
  }

  private AlertSubscription subscription(ResultSet row, int rowNumber) throws SQLException {
    return new AlertSubscription(
        row.getLong("id"),
        row.getInt("alert_package_id"),
        row.getString("title"),
        row.getString("description"),
        row.getString("scope"),
        row.getString("centre_id"),
        row.getObject("county_id", Integer.class),
        row.getObject("created_at", OffsetDateTime.class));
  }

  private static ResponseStatusException refused(String detail) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, detail);
  }

  private record Package(int id, String scope, boolean active) {}
}
