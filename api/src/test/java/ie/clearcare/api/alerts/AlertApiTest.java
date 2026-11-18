package ie.clearcare.api.alerts;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
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
 * The alert routes of ADR-0034 against PostgreSQL with this repository's roles and schema, logged in
 * as clearcare_api: each scope, the same request twice, stopping and subscribing again, the labels
 * read from the register, an unknown home or county, the unsubscribe link, and the refusals.
 *
 * <p>Each case uses an account of its own, so they hold whichever order they run in.
 */
@SpringBootTest(
    properties = {
      "clearcare.site.token=the-sites-own-token",
      "clearcare.alerts.link-secret=the-link-secret"
    })
@AutoConfigureMockMvc
@Testcontainers
class AlertApiTest {

  private static final String ACCOUNT = "X-ClearCare-Sub";
  private static final String TOKEN = "X-ClearCare-Token";
  private static final String SITE = "the-sites-own-token";
  private static final String SECRET = "the-link-secret";

  private static final String FACILITY = "1f2e3d4c-0000-4000-8000-000000000101";
  private static final String SCOPES = "1f2e3d4c-0000-4000-8000-000000000102";
  private static final String A_COUNTY = "1f2e3d4c-0000-4000-8000-00000000010a";
  private static final String EVERYTHING = "1f2e3d4c-0000-4000-8000-00000000010b";
  private static final String TWICE = "1f2e3d4c-0000-4000-8000-000000000103";
  private static final String AGAIN = "1f2e3d4c-0000-4000-8000-000000000104";
  private static final String UNKNOWN = "1f2e3d4c-0000-4000-8000-000000000105";
  private static final String LINKED = "1f2e3d4c-0000-4000-8000-000000000106";
  private static final String TAMPERED = "1f2e3d4c-0000-4000-8000-000000000107";
  private static final String SOMEONE_ELSE = "1f2e3d4c-0000-4000-8000-000000000108";
  private static final String OTHER_ACCOUNT = "1f2e3d4c-0000-4000-8000-000000000109";

  @Autowired private MockMvc mvc;

  // A home, with the register's own name as its label.
  @Test
  void subscribesToAFacility() throws Exception {
    subscribe(FACILITY, "/alerts/facility/34")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.scope").value("FACILITY"))
        .andExpect(jsonPath("$.label").value("Aras Ui Dhomhnaill Nursing Home"))
        .andExpect(jsonPath("$.metadata.centre_id").value("34"))
        .andExpect(jsonPath("$.active").value(true));
  }

  // A county is stored by its id and shown by its name.
  @Test
  void subscribesToACounty() throws Exception {
    subscribe(A_COUNTY, "/alerts/county/Dublin")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.scope").value("COUNTY"))
        .andExpect(jsonPath("$.label").value("Dublin"))
        .andExpect(jsonPath("$.metadata.county_id").isNumber());
  }

  // Everything names nothing.
  @Test
  void subscribesToEverything() throws Exception {
    subscribe(EVERYTHING, "/alerts/all")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.scope").value("ALL"))
        .andExpect(jsonPath("$.label").value("Every home"))
        .andExpect(jsonPath("$.metadata").isEmpty());
  }

  // All three at once come back oldest first, with the label each is shown by.
  @Test
  void listsEverythingTheAccountAskedFor() throws Exception {
    subscribe(SCOPES, "/alerts/facility/34").andExpect(status().isOk());
    subscribe(SCOPES, "/alerts/county/Dublin").andExpect(status().isOk());
    subscribe(SCOPES, "/alerts/all").andExpect(status().isOk());

    read(SCOPES)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.subscriptions", hasSize(3)))
        .andExpect(jsonPath("$.subscriptions[*].scope", contains("FACILITY", "COUNTY", "ALL")))
        .andExpect(jsonPath("$.subscriptions[*].label", contains("Aras Ui Dhomhnaill Nursing Home", "Dublin", "Every home")));
  }

  // Asking twice is the same subscription, answered with the same row.
  @Test
  void answersTheSameRowForTheSameRequest() throws Exception {
    String first = subscribe(TWICE, "/alerts/facility/34").andExpect(status().isOk()).andReturn()
        .getResponse().getContentAsString();
    String second = subscribe(TWICE, "/alerts/facility/34").andExpect(status().isOk()).andReturn()
        .getResponse().getContentAsString();

    assertThatId(first).isEqualTo(idOf(second));
    read(TWICE).andExpect(jsonPath("$.subscriptions", hasSize(1)));
  }

  // Stopping keeps the row; subscribing again reactivates it, with the id it had.
  @Test
  void reactivatesTheRowItStopped() throws Exception {
    String created = subscribe(AGAIN, "/alerts/facility/456").andExpect(status().isOk()).andReturn()
        .getResponse().getContentAsString();
    long id = idOf(created);

    stop(AGAIN, id).andExpect(status().isNoContent());
    read(AGAIN).andExpect(jsonPath("$.subscriptions", hasSize(0)));

    String again = subscribe(AGAIN, "/alerts/facility/456").andExpect(status().isOk()).andReturn()
        .getResponse().getContentAsString();
    assertThatId(again).isEqualTo(id);
    read(AGAIN).andExpect(jsonPath("$.subscriptions", hasSize(1))).andExpect(jsonPath("$.subscriptions[0].active").value(true));
  }

  // A home the register does not have, and a county it does not have, are refused before anything is
  // written.
  @Test
  void refusesAHomeOrCountyThatDoesNotExist() throws Exception {
    subscribe(UNKNOWN, "/alerts/facility/999999")
        .andExpect(status().isBadRequest())
        .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON));
    subscribe(UNKNOWN, "/alerts/county/Atlantis").andExpect(status().isBadRequest());
    read(UNKNOWN).andExpect(jsonPath("$.subscriptions", hasSize(0)));
  }

  // The link in an email stops everything, and needs no account header.
  @Test
  void stopsEverythingFromTheLink() throws Exception {
    subscribe(LINKED, "/alerts/facility/34").andExpect(status().isOk());
    subscribe(LINKED, "/alerts/county/Dublin").andExpect(status().isOk());

    mvc.perform(
            post("/alerts/unsubscribe")
                .header(TOKEN, SITE)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\": \"" + link(LINKED) + "\"}"))
        .andExpect(status().isNoContent());

    read(LINKED).andExpect(jsonPath("$.subscriptions", hasSize(0)));
  }

  // A signature that is not this deployment's changes nothing.
  @Test
  void refusesATamperedLink() throws Exception {
    subscribe(TAMPERED, "/alerts/facility/34").andExpect(status().isOk());

    mvc.perform(
            post("/alerts/unsubscribe")
                .header(TOKEN, SITE)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\": \"" + link(TAMPERED).replaceAll(".$", "0") + "\"}"))
        .andExpect(status().isUnauthorized());

    read(TAMPERED).andExpect(jsonPath("$.subscriptions", hasSize(1)));
  }

  // An id that belongs to someone else is answered as if it did not exist, and stops nothing.
  @Test
  void doesNotStopAnotherAccountsSubscription() throws Exception {
    String mine = subscribe(SOMEONE_ELSE, "/alerts/facility/34").andExpect(status().isOk()).andReturn()
        .getResponse().getContentAsString();

    stop(OTHER_ACCOUNT, idOf(mine)).andExpect(status().isNotFound());

    read(SOMEONE_ELSE).andExpect(jsonPath("$.subscriptions", hasSize(1)));
  }

  // A request that is not the site's is refused, and one that names no account is refused too.
  @Test
  void refusesRequestsThatAreNotTheSites() throws Exception {
    mvc.perform(get("/alerts")).andExpect(status().isUnauthorized());
    mvc.perform(get("/alerts").header(TOKEN, "not-the-sites-token")).andExpect(status().isUnauthorized());
    mvc.perform(get("/alerts").header(TOKEN, SITE)).andExpect(status().isUnauthorized());
    mvc.perform(put("/alerts/all").header(TOKEN, SITE)).andExpect(status().isUnauthorized());
  }

  private ResultActions subscribe(String sub, String path) throws Exception {
    return mvc.perform(put(path).header(ACCOUNT, sub).header(TOKEN, SITE));
  }

  private ResultActions read(String sub) throws Exception {
    return mvc.perform(get("/alerts").header(ACCOUNT, sub).header(TOKEN, SITE));
  }

  private ResultActions stop(String sub, long id) throws Exception {
    return mvc.perform(delete("/alerts/" + id).header(ACCOUNT, sub).header(TOKEN, SITE));
  }

  private static long idOf(String document) {
    java.util.regex.Matcher matcher =
        java.util.regex.Pattern.compile("\"id\":\\s*(\\d+)").matcher(document);
    matcher.find();
    return Long.parseLong(matcher.group(1));
  }

  private static org.assertj.core.api.AbstractLongAssert<?> assertThatId(String document) {
    return org.assertj.core.api.Assertions.assertThat(idOf(document));
  }

  private static String link(String subject) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    return subject
        + "."
        + HexFormat.of().formatHex(mac.doFinal(subject.getBytes(StandardCharsets.UTF_8)));
  }

  // Maven runs the tests in api/.
  private static final Path REPOSITORY = Path.of("..");
  // roles.sql needs a password for each role; only the API's is used here.
  private static final String PASSWORD = UUID.randomUUID().toString();

  // V26 needs the schema and the register the labels are read from (V1), the accounts a
  // subscription belongs to (V15) and the counties the COUNTY package names (V25).
  private static final List<String> MIGRATIONS =
      List.of(
          "db/V1__register_entries.sql",
          "db/V15__user_preferences.sql",
          "db/V25__county.sql",
          "db/V26__user_alerts.sql");

  // Two homes in two counties, as the pipeline loads them, and the publication that serves them.
  private static final String SNAPSHOT =
      """
      INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)
      VALUES (
          'older_persons_register',
          'https://www.hiqa.ie/centre/export/older_persons_register.csv?_format=csv',
          'c24a105a5f1df7026a9e1a86977273f9987b07c3137fb21fed8265a18cd90337',
          '2026-10-05 06:12:54.481+00');

      INSERT INTO clearcare.centre (centre_id) VALUES ('34'), ('456');

      INSERT INTO clearcare.register_entry (
          source_file_id, centre_id, source_record, centre_name, address, county, eircode,
          maximum_occupancy, provider_name, hiqa_url, extracted_at, extractor_version)
      VALUES
          (1, '34', 1, 'Aras Ui Dhomhnaill Nursing Home',
           'Loughlinstown Road, Celbridge, W23 P6EX', 'Kildare', 'W23P6EX',
           62, 'Springwood Nursing Homes Limited',
           'https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall-nursing-home', now(), 'test'),
          (1, '456', 2, 'Elm Hall Nursing Home', 'Main Street, Dublin 9', 'Dublin',
           NULL, 40, NULL, 'https://www.hiqa.ie/test/456', now(), 'test');

      INSERT INTO clearcare.alert_packages (name, scope, is_active) VALUES
          ('A home I follow', 'FACILITY', TRUE),
          ('A county', 'COUNTY', TRUE),
          ('Every home', 'ALL', TRUE);

      INSERT INTO clearcare.register_publication (source_file_id, published_at) VALUES (1, now());
      """;

  @Container static final PostgreSQLContainer database = DatabaseImage.newDatabase(PASSWORD);

  @DynamicPropertySource
  static void connectAsTheApi(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", database::getJdbcUrl);
    registry.add("spring.datasource.password", () -> PASSWORD);
  }

  // As the container's superuser. The migrations run as clearcare_owner, as Flyway runs them.
  @BeforeAll
  static void createTheSchema() throws Exception {
    for (String migration : MIGRATIONS) {
      execute("SET ROLE clearcare_owner;\n" + Files.readString(REPOSITORY.resolve(migration)));
    }
    execute("SET ROLE clearcare_owner;\n" + SNAPSHOT);
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
}
