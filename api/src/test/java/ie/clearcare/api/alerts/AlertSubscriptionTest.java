package ie.clearcare.api.alerts;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import ie.clearcare.api.DatabaseImage;

/**
 * The alerts routes against PostgreSQL with the roles and schema from this repository, logged in as
 * clearcare_api: the role the migrations have to have granted, or every case here fails.
 *
 * <p>Each case uses an account of its own, so they hold whichever order they run in. The packages
 * come from V28, the centres and counties from V1 and V25, and V26 is the subscription tables.
 */
@SpringBootTest(properties = "clearcare.site.token=the-sites-own-token")
@AutoConfigureMockMvc
@Testcontainers
class AlertSubscriptionTest {

  private static final String TOKEN = "the-sites-own-token";

  // Maven runs the tests in api/.
  private static final Path REPOSITORY = Path.of("..");
  // roles.sql needs a password for each role; only the API's is used here.
  private static final String PASSWORD = UUID.randomUUID().toString();

  // V1 creates the schema, the centre table and the roles' usage of it; V15 the accounts; V25 the
  // counties; V26 the alert tables; V28 seeds the three packages; V30 grants the API the centre and
  // county tables it checks targets against.
  private static final List<String> MIGRATIONS =
      List.of(
          "db/V1__register_entries.sql",
          "db/V15__user_preferences.sql",
          "db/V25__county.sql",
          "db/V26__user_alerts.sql",
          "db/V28__seed_alert_packages.sql",
          "db/V30__alert_target_grants.sql");

  private static final String NOTHING = "2f2e3d4c-0000-4000-8000-000000000000";
  private static final String EVERYTHING = "2f2e3d4c-0000-4000-8000-000000000001";
  private static final String TWICE = "2f2e3d4c-0000-4000-8000-000000000002";
  private static final String REFUSED = "2f2e3d4c-0000-4000-8000-000000000003";
  private static final String MINE = "2f2e3d4c-0000-4000-8000-000000000004";
  private static final String THEIRS = "2f2e3d4c-0000-4000-8000-000000000005";
  private static final String UNSUBSCRIBING = "2f2e3d4c-0000-4000-8000-000000000006";
  private static final String REFUSED_AUTH = "2f2e3d4c-0000-4000-8000-000000000007";
  private static final String EXTRA = "2f2e3d4c-0000-4000-8000-000000000008";

  private static final String CENTRE = "117";
  private static final long CENTRE_PACKAGE = 1;
  private static final long COUNTY_PACKAGE = 2;
  private static final long ALL_PACKAGE = 3;
  private static final String UNSUBSCRIBE_TOKEN = "00000000-0000-4000-8000-0000000000aa";

  @Container
  static final PostgreSQLContainer database = DatabaseImage.newDatabase(PASSWORD);

  // The user name comes from application.properties.
  @DynamicPropertySource
  static void connectAsTheApi(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", database::getJdbcUrl);
    registry.add("spring.datasource.password", () -> PASSWORD);
  }

  @Autowired private MockMvc mvc;

  // As the container's superuser. The migrations run as clearcare_owner, as Flyway runs them.
  @BeforeAll
  static void createTheSchema() throws Exception {
    for (String migration : MIGRATIONS) {
      execute("SET ROLE clearcare_owner;\n" + Files.readString(REPOSITORY.resolve(migration)));
    }
    execute("SET ROLE clearcare_owner; INSERT INTO clearcare.centre (centre_id) VALUES ('117')");
  }

  @Test
  void returnsNothingBeforeTheVisitorFollowsAnything() throws Exception {
    read(NOTHING)
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.subscriptions").isEmpty());
  }

  @Test
  void followsACentreACountyAndEveryReport() throws Exception {
    int dublin = countyId("Dublin");

    add(EVERYTHING, centre(CENTRE_PACKAGE, CENTRE))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.package_id").value(CENTRE_PACKAGE))
        .andExpect(jsonPath("$.scope").value("CENTRE"))
        .andExpect(jsonPath("$.centre_id").value(CENTRE))
        .andExpect(jsonPath("$.county_id").value(nullValue()))
        .andExpect(jsonPath("$.created_at").isNotEmpty());
    add(EVERYTHING, county(COUNTY_PACKAGE, dublin))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.scope").value("COUNTY"))
        .andExpect(jsonPath("$.centre_id").value(nullValue()))
        .andExpect(jsonPath("$.county_id").value(dublin));
    add(EVERYTHING, "{\"package_id\": %d}".formatted(ALL_PACKAGE))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.scope").value("ALL"));

    // Newest first: the all-reports row was added last, and ids break a tie on the clock.
    read(EVERYTHING)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.subscriptions.length()").value(3))
        .andExpect(jsonPath("$.subscriptions[0].scope").value("ALL"))
        .andExpect(jsonPath("$.subscriptions[2].centre_id").value(CENTRE));
  }

  @Test
  void keepsOneRowWhenTheSameTargetIsAddedTwice() throws Exception {
    add(TWICE, centre(CENTRE_PACKAGE, CENTRE)).andExpect(status().isOk());
    add(TWICE, centre(CENTRE_PACKAGE, CENTRE))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.scope").value("CENTRE"));

    read(TWICE).andExpect(jsonPath("$.subscriptions.length()").value(1));
    assertThat(rows(TWICE)).isEqualTo(1);
  }

  @Test
  void refusesAPackageThatIsNotOpen() throws Exception {
    // The seed has one package per scope, so the centre package is switched off rather than a
    // second one added, and the case puts it back even when an assertion fails.
    setPackageActive("CENTRE", false);
    try {
      add(REFUSED, centre(CENTRE_PACKAGE, CENTRE))
          .andExpect(status().isBadRequest())
          .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
          .andExpect(jsonPath("$.detail").value("package_id must name an active alert package"));
    } finally {
      setPackageActive("CENTRE", true);
    }

    add(REFUSED, centre(999_999, CENTRE))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.detail").value("package_id must name an active alert package"));
    assertThat(rows(REFUSED)).isZero();
  }

  @Test
  void refusesATargetTheScopeDoesNotTake() throws Exception {
    add(REFUSED, "{\"package_id\": %d, \"county_id\": 1}".formatted(CENTRE_PACKAGE))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.detail").value("a CENTRE package takes centre_id and no county_id"));
    add(
            REFUSED,
            "{\"package_id\": %d, \"centre_id\": \"117\", \"county_id\": 1}"
                .formatted(CENTRE_PACKAGE))
        .andExpect(status().isBadRequest());
    add(REFUSED, centre(COUNTY_PACKAGE, CENTRE)).andExpect(status().isBadRequest());
    add(REFUSED, centre(ALL_PACKAGE, CENTRE)).andExpect(status().isBadRequest());
    add(REFUSED, "{\"package_id\": %d, \"centre_id\": \"117a\"}".formatted(CENTRE_PACKAGE))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.detail").value("centre_id must be digits"));

    assertThat(rows(REFUSED)).isZero();
  }

  @Test
  void refusesATargetThatDoesNotExist() throws Exception {
    add(REFUSED, centre(CENTRE_PACKAGE, "999999"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.detail").value("no centre with that id"));
    add(REFUSED, county(COUNTY_PACKAGE, 999_999))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.detail").value("no county with that id"));

    assertThat(rows(REFUSED)).isZero();
  }

  @Test
  void refusesARequestWithoutAPackage() throws Exception {
    add(REFUSED, "{\"centre_id\": \"117\"}")
        .andExpect(status().isBadRequest())
        .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.detail").value("package_id is required"));
    add(REFUSED, "{}").andExpect(status().isBadRequest());

    assertThat(rows(REFUSED)).isZero();
  }

  // The target is built here from the fields the API read, never taken from the body, so a body
  // that ships metadata or an id of its own cannot choose what is stored.
  @Test
  void ignoresFieldsTheApiDoesNotKnow() throws Exception {
    add(
            EXTRA,
            "{\"package_id\": 1, \"centre_id\": \"117\", "
                + "\"metadata\": [{\"centre_id\": \"999\"}], \"id\": 5}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.centre_id").value("117"))
        .andExpect(jsonPath("$.id").isNumber());
  }

  @Test
  void cancelsOnlyThisAccountsSubscription() throws Exception {
    String mine =
        add(MINE, centre(CENTRE_PACKAGE, CENTRE))
            .andReturn()
            .getResponse()
            .getContentAsString()
            .replaceAll(".*\"id\":(\\d+).*", "$1");
    String theirs =
        add(THEIRS, centre(CENTRE_PACKAGE, CENTRE))
            .andReturn()
            .getResponse()
            .getContentAsString()
            .replaceAll(".*\"id\":(\\d+).*", "$1");

    cancel(MINE, theirs).andExpect(status().isNoContent());
    read(THEIRS).andExpect(jsonPath("$.subscriptions.length()").value(1));

    cancel(MINE, mine).andExpect(status().isNoContent());
    cancel(MINE, mine).andExpect(status().isNoContent());
    read(MINE).andExpect(jsonPath("$.subscriptions").isEmpty());
  }

  @Test
  void unsubscribesEverySubscriptionWithTheToken() throws Exception {
    add(UNSUBSCRIBING, centre(CENTRE_PACKAGE, CENTRE)).andExpect(status().isOk());
    add(UNSUBSCRIBING, "{\"package_id\": %d}".formatted(ALL_PACKAGE))
        .andExpect(status().isOk());
    execute(
        "SET ROLE clearcare_owner; INSERT INTO clearcare.alert_unsubscribe (user_id, token) "
            + "SELECT id, '"
            + UNSUBSCRIBE_TOKEN
            + "' FROM clearcare.users WHERE cognito_sub = '"
            + UNSUBSCRIBING
            + "'");
    assertThat(rows(UNSUBSCRIBING)).isEqualTo(2);

    unsubscribe(UNSUBSCRIBE_TOKEN).andExpect(status().isNoContent());
    assertThat(rows(UNSUBSCRIBING)).isZero();
    // A reloaded page, or a second click, is not an error.
    unsubscribe(UNSUBSCRIBE_TOKEN).andExpect(status().isNoContent());

    unsubscribe("00000000-0000-4000-8000-00000000dead")
        .andExpect(status().isNotFound())
        .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.detail").value("This unsubscribe link is not valid."));
  }

  @Test
  void refusesARequestThatIsNotTheSites() throws Exception {
    mvc.perform(get("/alerts/subscriptions").header("X-ClearCare-Sub", REFUSED_AUTH))
        .andExpect(status().isUnauthorized());
    mvc.perform(
            get("/alerts/subscriptions")
                .header("X-ClearCare-Sub", REFUSED_AUTH)
                .header("X-ClearCare-Token", "not-the-token"))
        .andExpect(status().isUnauthorized());
    mvc.perform(get("/alerts/subscriptions").header("X-ClearCare-Token", TOKEN))
        .andExpect(status().isUnauthorized());
  }

  private ResultActions read(String account) throws Exception {
    return mvc.perform(
        get("/alerts/subscriptions")
            .header("X-ClearCare-Sub", account)
            .header("X-ClearCare-Token", TOKEN));
  }

  private ResultActions add(String account, String body) throws Exception {
    return mvc.perform(
        post("/alerts/subscriptions")
            .header("X-ClearCare-Sub", account)
            .header("X-ClearCare-Token", TOKEN)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  private ResultActions cancel(String account, String id) throws Exception {
    return mvc.perform(
        delete("/alerts/subscriptions/" + id)
            .header("X-ClearCare-Sub", account)
            .header("X-ClearCare-Token", TOKEN));
  }

  private ResultActions unsubscribe(String token) throws Exception {
    return mvc.perform(post("/alerts/unsubscribe").param("token", token));
  }

  private static String centre(long packageId, String centreId) {
    return "{\"package_id\": %d, \"centre_id\": \"%s\"}".formatted(packageId, centreId);
  }

  private static String county(long packageId, long countyId) {
    return "{\"package_id\": %d, \"county_id\": %d}".formatted(packageId, countyId);
  }

  private static long rows(String account) throws SQLException {
    return count(
        "SELECT count(*) FROM clearcare.alert_subscriptions s"
            + " JOIN clearcare.users u ON u.id = s.user_id"
            + " WHERE u.cognito_sub = '"
            + account
            + "'");
  }

  private static int countyId(String name) throws SQLException {
    return (int)
        count("SELECT id FROM clearcare.county WHERE name = '" + name + "'");
  }

  private static void setPackageActive(String scope, boolean active) throws SQLException {
    execute(
        "SET ROLE clearcare_owner; UPDATE clearcare.alert_packages SET is_active = "
            + active
            + " WHERE scope = '"
            + scope
            + "'");
  }

  private static long count(String sql) throws SQLException {
    try (Connection connection = database.createConnection("");
        Statement statement = connection.createStatement();
        var result = statement.executeQuery(sql)) {
      result.next();
      return result.getLong(1);
    }
  }

  private static void execute(String sql) throws SQLException {
    try (Connection connection = database.createConnection("");
        Statement statement = connection.createStatement()) {
      statement.execute(sql);
    }
  }
}
