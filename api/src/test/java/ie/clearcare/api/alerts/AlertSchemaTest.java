package ie.clearcare.api.alerts;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import ie.clearcare.api.DatabaseImage;

/**
 * V26 against PostgreSQL with this repository's roles: the seeded packages, the key a subscription is
 * held by, the states an event and a notification may be in, the county the COUNTY package names, the
 * cascades from an account, and the grants each role was given.
 *
 * <p>Every case reads or writes its own rows, so they hold whichever order they run in.
 */
@Testcontainers
class AlertSchemaTest {

  // Maven runs the tests in api/.
  private static final Path REPOSITORY = Path.of("..");
  // roles.sql needs a password for each role; the cases here use the superuser and SET ROLE.
  private static final String PASSWORD = UUID.randomUUID().toString();

  // V26 needs the schema (V1), the reports the events will describe (V2, V3), the accounts a
  // subscription belongs to (V15) and the counties the COUNTY package names (V25).
  private static final List<String> MIGRATIONS =
      List.of(
          "db/V1__register_entries.sql",
          "db/V2__inspection_reports.sql",
          "db/V3__inspection_report_views.sql",
          "db/V15__user_preferences.sql",
          "db/V25__county.sql",
          "db/V26__alert_system.sql");

  @Container static final PostgreSQLContainer database = DatabaseImage.newDatabase(PASSWORD);

  // As the container's superuser. The migrations run as clearcare_owner, as Flyway runs them.
  @BeforeAll
  static void createTheSchema() throws Exception {
    for (String migration : MIGRATIONS) {
      execute("SET ROLE clearcare_owner;\n" + Files.readString(REPOSITORY.resolve(migration)));
    }
  }

  // Four packages, in the order the migration seeds them: a home, a county, everything, and the
  // rotation that is kept out of the API's list until the dispatcher understands it.
  @Test
  void seedsTheFourPackages() throws Exception {
    assertThat(scopes())
        .containsExactly(
            "FACILITY", "COUNTY", "ALL", "RADIUS");
    assertThat(string("SELECT is_active::text FROM clearcare.alert_packages WHERE scope = 'RADIUS'"))
        .isEqualTo("false");
    assertThat(string("SELECT is_active::text FROM clearcare.alert_packages WHERE scope = 'COUNTY'"))
        .isEqualTo("true");
  }

  // A county is named by an id from clearcare.county, so the package's schema says integer and the
  // table it points into holds the twenty-six counties the register uses.
  @Test
  void namesACountyByIdFromTheCountyTable() throws Exception {
    assertThat(
            string(
                "SELECT context_schema -> 'properties' -> 'county_id' ->> 'type'"
                    + " FROM clearcare.alert_packages WHERE scope = 'COUNTY'"))
        .isEqualTo("integer");
    assertThat(string("SELECT count(*) FROM clearcare.county")).isEqualTo("26");
    assertThat(string("SELECT name FROM clearcare.county WHERE id = 1")).isNotBlank();
  }

  // Asking twice for the same home is the same subscription: the natural key refuses the second row.
  @Test
  void refusesTheSameSubscriptionTwice() throws Exception {
    long user = account("sub-twice");
    subscribe(user, 1L, "{\"centre_id\": \"187\"}");

    assertThatThrownBy(() -> subscribe(user, 1L, "{\"centre_id\": \"187\"}"))
        .isInstanceOf(SQLException.class)
        .hasMessageContaining("alert_subscriptions_natural_key");
  }

  // Unsubscribing and subscribing again is the row they had, activated, so the notifications under
  // it stay readable.
  @Test
  void reactivatesTheRowItHad() throws Exception {
    long user = account("sub-again");
    long first = subscribe(user, 1L, "{\"centre_id\": \"412\"}");
    execute(
        "UPDATE clearcare.alert_subscriptions"
            + " SET is_active = FALSE, deactivated_at = now() WHERE id = "
            + first);

    long again =
        insert(
            "INSERT INTO clearcare.alert_subscriptions (user_id, alert_package_id, context)"
                + " VALUES ("
                + user
                + ", 1, '{\"centre_id\": \"412\"}')"
                + " ON CONFLICT (user_id, alert_package_id, context)"
                + " DO UPDATE SET is_active = TRUE, deactivated_at = NULL RETURNING id");

    assertThat(again).isEqualTo(first);
    assertThat(string("SELECT is_active::text FROM clearcare.alert_subscriptions WHERE id = " + again))
        .isEqualTo("true");
    assertThat(
            string(
                "SELECT (deactivated_at IS NULL)::text FROM clearcare.alert_subscriptions WHERE id = "
                    + again))
        .isEqualTo("true");
  }

  // A row cannot be both live and ended, nor dead and undated.
  @Test
  void keepsDeactivationPaired() throws Exception {
    long user = account("sub-paired");

    assertThatThrownBy(
            () ->
                execute(
                    "INSERT INTO clearcare.alert_subscriptions"
                        + " (user_id, alert_package_id, context, is_active)"
                        + " VALUES ("
                        + user
                        + ", 2, '{\"county_id\": 1}', FALSE)"))
        .isInstanceOf(SQLException.class)
        .hasMessageContaining("alert_subscriptions_deactivation_paired");
  }

  // The context is a document of the package's shape, and the metadata is a document too; an array
  // is not either of them.
  @Test
  void keepsContextAndMetadataAsDocuments() throws Exception {
    long event = insert("INSERT INTO clearcare.alert_events (alert_package_id, context, metadata)"
        + " VALUES (2, '{\"county_id\": 11}', '{\"report_ids\": [\"a\", \"b\"]}') RETURNING id");

    assertThat(
            string(
                "SELECT jsonb_typeof(metadata -> 'report_ids') FROM clearcare.alert_events"
                    + " WHERE id = "
                    + event))
        .isEqualTo("array");
    assertThatThrownBy(
            () ->
                execute(
                    "INSERT INTO clearcare.alert_events (alert_package_id, context)"
                        + " VALUES (2, '[]')"))
        .isInstanceOf(SQLException.class)
        .hasMessageContaining("alert_events_context_check");
  }

  // An event is pending, being resolved, or resolved; resolved carries the moment it was.
  @Test
  void keepsEventStatusAndProcessedAtInStep() throws Exception {
    assertThat(
            string(
                "SELECT status FROM clearcare.alert_events WHERE id = "
                    + insert(
                        "INSERT INTO clearcare.alert_events (alert_package_id, context)"
                            + " VALUES (3, '{}') RETURNING id")))
        .isEqualTo("PENDING");

    assertThatThrownBy(
            () ->
                execute(
                    "INSERT INTO clearcare.alert_events (alert_package_id, context, status)"
                        + " VALUES (3, '{}', 'PROCESSED')"))
        .isInstanceOf(SQLException.class)
        .hasMessageContaining("alert_events_processed_at_paired");

    assertThatThrownBy(
            () ->
                execute(
                    "INSERT INTO clearcare.alert_events (alert_package_id, context, status)"
                        + " VALUES (3, '{}', 'SENT')"))
        .isInstanceOf(SQLException.class)
        .hasMessageContaining("alert_events_status_check");
  }

  // A notification is queued, with the sender, sent, or failed; sent carries the moment it was.
  @Test
  void keepsNotificationStatusAndSentAtInStep() throws Exception {
    long user = account("notif-states");

    assertThatThrownBy(
            () ->
                execute(
                    "INSERT INTO clearcare.alert_notifications (user_id, status, context)"
                        + " VALUES ("
                        + user
                        + ", 'SENT', '{\"centre_id\": \"187\"}')"))
        .isInstanceOf(SQLException.class)
        .hasMessageContaining("alert_notifications_sent_at_paired");

    assertThatThrownBy(
            () ->
                execute(
                    "INSERT INTO clearcare.alert_notifications (user_id, status, context)"
                        + " VALUES ("
                        + user
                        + ", 'BOUNCED', '{\"centre_id\": \"187\"}')"))
        .isInstanceOf(SQLException.class)
        .hasMessageContaining("alert_notifications_status_check");
  }

  // An account that goes takes what it asked for and what was sent to it.
  @Test
  void takesSubscriptionsAndNotificationsWithTheAccount() throws Exception {
    long user = account("account-goes");
    subscribe(user, 1L, "{\"centre_id\": \"738\"}");
    execute(
        "INSERT INTO clearcare.alert_notifications (user_id, context)"
            + " VALUES ("
            + user
            + ", '{\"centre_id\": \"738\"}')");

    execute("DELETE FROM clearcare.users WHERE id = " + user);

    assertThat(
            string("SELECT count(*) FROM clearcare.alert_subscriptions WHERE user_id = " + user))
        .isEqualTo("0");
    assertThat(
            string("SELECT count(*) FROM clearcare.alert_notifications WHERE user_id = " + user))
        .isEqualTo("0");
  }

  // The API writes a visitor's own choices and reads the catalogue; it never sees an event or a
  // notification.
  @Test
  void grantsTheApiTheSubscriptionsAndNothingElse() throws Exception {
    assertThat(privileges("clearcare_api", "alert_subscriptions"))
        .containsExactly("INSERT", "SELECT", "UPDATE");
    assertThat(privileges("clearcare_api", "alert_packages")).containsExactly("SELECT");
    assertThat(privileges("clearcare_api", "alert_events")).isEmpty();
    assertThat(privileges("clearcare_api", "alert_notifications")).isEmpty();
    assertThat(
            string(
                "SELECT has_table_privilege('clearcare_api', 'clearcare.county', 'SELECT')::text"))
        .isEqualTo("true");
  }

  // The pipeline writes what it noticed and what it sent, and reads the subscriptions of the
  // moment; it does not write one.
  @Test
  void grantsThePipelineTheEventsAndNotTheSubscriptions() throws Exception {
    assertThat(privileges("clearcare_pipeline", "alert_events"))
        .containsExactly("INSERT", "SELECT", "UPDATE");
    assertThat(privileges("clearcare_pipeline", "alert_notifications"))
        .containsExactly("INSERT", "SELECT", "UPDATE");
    assertThat(privileges("clearcare_pipeline", "alert_subscriptions")).containsExactly("SELECT");
    assertThat(privileges("clearcare_pipeline", "alert_packages")).containsExactly("SELECT");
    assertThat(string("SELECT has_table_privilege('clearcare_pipeline', 'clearcare.users', 'SELECT')::text"))
        .isEqualTo("true");
  }

  private static Connection connection() throws SQLException {
    return DriverManager.getConnection(
        database.getJdbcUrl(), database.getUsername(), database.getPassword());
  }

  private static void execute(String sql) throws SQLException {
    try (Connection connection = connection();
        Statement statement = connection.createStatement()) {
      statement.execute(sql);
    }
  }

  private static long account(String sub) throws SQLException {
    return insert("INSERT INTO clearcare.users (cognito_sub) VALUES ('" + sub + "') RETURNING id");
  }

  private static long subscribe(long user, long packageId, String context) throws SQLException {
    return insert(
        "INSERT INTO clearcare.alert_subscriptions (user_id, alert_package_id, context)"
            + " VALUES ("
            + user
            + ", "
            + packageId
            + ", '"
            + context
            + "') RETURNING id");
  }

  private static long insert(String sql) throws SQLException {
    try (Connection connection = connection();
        Statement statement = connection.createStatement();
        ResultSet rows = statement.executeQuery(sql)) {
      rows.next();
      return rows.getLong(1);
    }
  }

  private static String string(String sql) throws SQLException {
    try (Connection connection = connection();
        Statement statement = connection.createStatement();
        ResultSet rows = statement.executeQuery(sql)) {
      assertThat(rows.next()).isTrue();
      return rows.getString(1);
    }
  }

  private static List<String> scopes() throws SQLException {
    return strings("SELECT scope FROM clearcare.alert_packages ORDER BY id");
  }

  private static List<String> privileges(String role, String table) throws SQLException {
    return strings(
        "SELECT p FROM unnest(ARRAY['DELETE', 'INSERT', 'SELECT', 'TRUNCATE', 'UPDATE']) p"
            + " WHERE has_table_privilege('"
            + role
            + "', 'clearcare."
            + table
            + "', p) ORDER BY p");
  }

  private static List<String> strings(String sql) throws SQLException {
    try (Connection connection = connection();
        Statement statement = connection.createStatement();
        ResultSet rows = statement.executeQuery(sql)) {
      List<String> values = new java.util.ArrayList<>();
      while (rows.next()) {
        values.add(rows.getString(1));
      }
      return values;
    }
  }
}
