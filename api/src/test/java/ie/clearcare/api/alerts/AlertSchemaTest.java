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
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import ie.clearcare.api.DatabaseImage;

/**
 * V26 as created: the catalogue is empty and nothing is seeded, the context columns are gone, a
 * subscription is held by account, package and the metadata document that names what it is about,
 * the statuses and metadata documents hold, the account cascade works, and each role has only its
 * grants.
 *
 * <p>The first case reads the catalogue as the migration leaves it; the rest add their own package
 * rows, so they hold whichever order they run in after that.
 */
@Testcontainers
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AlertSchemaTest {

  // Maven runs the tests in api/.
  private static final Path REPOSITORY = Path.of("..");
  // roles.sql needs a password for each role; the cases here use the superuser and SET ROLE.
  private static final String PASSWORD = UUID.randomUUID().toString();

  // V26 needs the schema (V1), the reports the events will describe (V2, V3), the accounts a
  // subscription belongs to (V15) and the counties the API still reads (V25).
  private static final List<String> MIGRATIONS =
      List.of(
          "db/V1__register_entries.sql",
          "db/V2__inspection_reports.sql",
          "db/V3__inspection_report_views.sql",
          "db/V15__user_preferences.sql",
          "db/V25__county.sql",
          "db/V26__user_alerts.sql");

  @Container static final PostgreSQLContainer database = DatabaseImage.newDatabase(PASSWORD);

  // As the container's superuser. The migrations run as clearcare_owner, as Flyway runs them.
  @BeforeAll
  static void createTheSchema() throws Exception {
    for (String migration : MIGRATIONS) {
      execute("SET ROLE clearcare_owner;\n" + Files.readString(REPOSITORY.resolve(migration)));
    }
  }

  // V26 creates the catalogue but seeds no rows, and a package added later starts inactive.
  @Test
  @Order(1)
  void createsTheCatalogueEmpty() throws Exception {
    assertThat(string("SELECT count(*) FROM clearcare.alert_packages")).isEqualTo("0");
    assertThat(
            string(
                "SELECT column_default FROM information_schema.columns"
                    + " WHERE table_schema = 'clearcare' AND table_name = 'alert_packages'"
                    + " AND column_name = 'is_active'"))
        .isEqualTo("false");
  }

  // The first draft's context columns are not in the schema any more.
  @Test
  void removesTheContextColumns() throws Exception {
    assertThat(
            strings(
                "SELECT column_name FROM information_schema.columns"
                    + " WHERE table_schema = 'clearcare'"
                    + " AND table_name IN ('alert_packages', 'alert_subscriptions',"
                    + " 'alert_events', 'alert_notifications')"
                    + " AND column_name IN ('context_schema', 'context', 'latitude',"
                    + " 'longitude', 'radius_miles')"
                    + " ORDER BY column_name"))
        .isEmpty();
  }

  // Asking twice for the same home is the same subscription: the natural key refuses the second
  // row.
  @Test
  void holdsASubscriptionByAccountPackageAndMetadata() throws Exception {
    long packageId = aPackage("FACILITY");
    long user = account("sub-twice");
    subscribe(user, packageId, "{\"centre_id\": \"187\"}");

    assertThatThrownBy(() -> subscribe(user, packageId, "{\"centre_id\": \"187\"}"))
        .isInstanceOf(SQLException.class)
        .hasMessageContaining("alert_subscriptions_natural_key");
  }

  // Two homes under the same package are two subscriptions, because the metadata differs.
  @Test
  void keepsDifferentSubjectsApart() throws Exception {
    long packageId = aPackage("FACILITY");
    long user = account("sub-subjects");
    long first = subscribe(user, packageId, "{\"centre_id\": \"187\"}");
    long second = subscribe(user, packageId, "{\"centre_id\": \"412\"}");

    assertThat(second).isNotEqualTo(first);
    assertThat(
            string("SELECT count(*) FROM clearcare.alert_subscriptions WHERE user_id = " + user))
        .isEqualTo("2");
  }

  // Unsubscribing and subscribing again is the row they had, activated, so the notifications under
  // it stay readable.
  @Test
  void reactivatesTheRowItHad() throws Exception {
    long packageId = aPackage("COUNTY");
    long user = account("sub-again");
    long first = subscribe(user, packageId);
    execute(
        "UPDATE clearcare.alert_subscriptions"
            + " SET is_active = FALSE, deactivated_at = now() WHERE id = "
            + first);

    long again =
        insert(
            "INSERT INTO clearcare.alert_subscriptions (user_id, alert_package_id, metadata)"
                + " VALUES ("
                + user
                + ", "
                + packageId
                + ", '{}'::jsonb)"
                + " ON CONFLICT (user_id, alert_package_id, metadata)"
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
    long packageId = aPackage("ALL");
    long user = account("sub-paired");

    assertThatThrownBy(
            () ->
                execute(
                    "INSERT INTO clearcare.alert_subscriptions"
                        + " (user_id, alert_package_id, is_active)"
                        + " VALUES ("
                        + user
                        + ", "
                        + packageId
                        + ", FALSE)"))
        .isInstanceOf(SQLException.class)
        .hasMessageContaining("alert_subscriptions_deactivation_paired");
  }

  // The metadata is a document; an array is not one.
  @Test
  void keepsMetadataAsADocument() throws Exception {
    long packageId = aPackage("FACILITY");
    long event =
        insert(
            "INSERT INTO clearcare.alert_events (alert_package_id, metadata)"
                + " VALUES ("
                + packageId
                + ", '{\"report_ids\": [\"a\", \"b\"]}') RETURNING id");

    assertThat(
            string(
                "SELECT jsonb_typeof(metadata -> 'report_ids') FROM clearcare.alert_events"
                    + " WHERE id = "
                    + event))
        .isEqualTo("array");
    assertThatThrownBy(
            () ->
                execute(
                    "INSERT INTO clearcare.alert_events (alert_package_id, metadata)"
                        + " VALUES ("
                        + packageId
                        + ", '[]')"))
        .isInstanceOf(SQLException.class)
        .hasMessageContaining("alert_events_metadata_check");
  }

  // An event is pending, being resolved, or resolved; resolved carries the moment it was.
  @Test
  void keepsEventStatusAndProcessedAtInStep() throws Exception {
    long packageId = aPackage("ALL");
    assertThat(
            string(
                "SELECT status FROM clearcare.alert_events WHERE id = "
                    + insert(
                        "INSERT INTO clearcare.alert_events (alert_package_id)"
                            + " VALUES ("
                            + packageId
                            + ") RETURNING id")))
        .isEqualTo("PENDING");

    assertThatThrownBy(
            () ->
                execute(
                    "INSERT INTO clearcare.alert_events (alert_package_id, status)"
                        + " VALUES ("
                        + packageId
                        + ", 'PROCESSED')"))
        .isInstanceOf(SQLException.class)
        .hasMessageContaining("alert_events_processed_at_paired");

    assertThatThrownBy(
            () ->
                execute(
                    "INSERT INTO clearcare.alert_events (alert_package_id, status)"
                        + " VALUES ("
                        + packageId
                        + ", 'SENT')"))
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
                    "INSERT INTO clearcare.alert_notifications (user_id, status)"
                        + " VALUES ("
                        + user
                        + ", 'SENT')"))
        .isInstanceOf(SQLException.class)
        .hasMessageContaining("alert_notifications_sent_at_paired");

    assertThatThrownBy(
            () ->
                execute(
                    "INSERT INTO clearcare.alert_notifications (user_id, status)"
                        + " VALUES ("
                        + user
                        + ", 'BOUNCED')"))
        .isInstanceOf(SQLException.class)
        .hasMessageContaining("alert_notifications_status_check");
  }

  // An account that goes takes what it asked for and what was sent to it.
  @Test
  void takesSubscriptionsAndNotificationsWithTheAccount() throws Exception {
    long packageId = aPackage("FACILITY");
    long user = account("account-goes");
    subscribe(user, packageId);
    execute("INSERT INTO clearcare.alert_notifications (user_id) VALUES (" + user + ")");

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

  // The tests add their own package rows: V26 seeds none.
  private static long aPackage(String scope) throws SQLException {
    return insert(
        "INSERT INTO clearcare.alert_packages (name, scope)"
            + " VALUES ('"
            + scope
            + " package', '"
            + scope
            + "') ON CONFLICT (scope) DO UPDATE SET name = EXCLUDED.name RETURNING id");
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

  private static long subscribe(long user, long packageId) throws SQLException {
    return subscribe(user, packageId, "{}");
  }

  private static long subscribe(long user, long packageId, String metadata) throws SQLException {
    return insert(
        "INSERT INTO clearcare.alert_subscriptions (user_id, alert_package_id, metadata)"
            + " VALUES ("
            + user
            + ", "
            + packageId
            + ", '"
            + metadata
            + "'::jsonb) RETURNING id");
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
