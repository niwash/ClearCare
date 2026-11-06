package ie.clearcare.api.preferences;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import org.testcontainers.utility.MountableFile;

/**
 * GET, PUT and DELETE /preferences against PostgreSQL with the roles and schema from this
 * repository, logged in as clearcare_api: the role the migration has to have granted, or every case
 * here fails.
 *
 * <p>Each case uses an account of its own, so they hold whichever order they run in.
 */
@SpringBootTest(properties = "clearcare.site.token=the-sites-own-token")
@AutoConfigureMockMvc
@Testcontainers
class UserPreferenceTest {

  private static final String TOKEN = "the-sites-own-token";

  // Maven runs the tests in api/.
  private static final Path REPOSITORY = Path.of("..");
  // roles.sql needs a password for each role; only the API's is used here.
  private static final String PASSWORD = UUID.randomUUID().toString();

  // V1 creates the schema and the roles' usage of it; V15 is the accounts and their saved
  // searches. Nothing else is needed: no case here reads a centre or a report.
  private static final List<String> MIGRATIONS =
      List.of("db/V1__register_entries.sql", "db/V15__user_preferences.sql");

  private static final String NOTHING_SAVED = "1f2e3d4c-0000-4000-8000-000000000000";
  private static final String SAVED = "1f2e3d4c-0000-4000-8000-000000000001";
  private static final String OPTIONS = "1f2e3d4c-0000-4000-8000-000000000002";
  private static final String REPLACED = "1f2e3d4c-0000-4000-8000-000000000003";
  private static final String FORGOTTEN = "1f2e3d4c-0000-4000-8000-000000000004";
  private static final String ONE_ACCOUNT = "1f2e3d4c-0000-4000-8000-000000000005";
  private static final String ANOTHER_ACCOUNT = "1f2e3d4c-0000-4000-8000-000000000006";
  private static final String REFUSED = "1f2e3d4c-0000-4000-8000-000000000007";

  private static final String CORK = """
      {"county": "Cork", "sort_by": "latest_inspection"}
      """;

  // roles.sql runs from the image's init scripts, as it does for a new local database.
  @Container
  static final PostgreSQLContainer database =
      new PostgreSQLContainer("postgres:18.6")
          .withDatabaseName("clearcare")
          .withCopyFileToContainer(
              MountableFile.forHostPath(REPOSITORY.resolve("infra/postgres/roles.sql")),
              "/docker-entrypoint-initdb.d/roles.sql")
          .withEnv("CLEARCARE_MIGRATOR_PASSWORD", PASSWORD)
          .withEnv("CLEARCARE_PIPELINE_PASSWORD", PASSWORD)
          .withEnv("CLEARCARE_API_PASSWORD", PASSWORD);

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
  }

  @Test
  void returnsNothingBeforeTheVisitorSavesASearch() throws Exception {
    read(NOTHING_SAVED)
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.preferences").value(nullValue()))
        .andExpect(jsonPath("$.updated_at").value(nullValue()));
  }

  // The saved search comes back as it was stored, with a list for every group it left out.
  @Test
  void savesTheSearchAndReturnsIt() throws Exception {
    save(SAVED, CORK)
        .andExpect(status().isOk())
        .andExpect(
            content()
                .json(
                    """
                    {
                      "preferences": {"county": "Cork", "sort_by": "latest_inspection",
                        "care_types": [], "room_types": [], "facilities": [], "activities": []}
                    }
                    """));

    read(SAVED)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.preferences.county").value("Cork"))
        .andExpect(jsonPath("$.preferences.sort_by").value("latest_inspection"))
        .andExpect(jsonPath("$.preferences.care_types").isEmpty())
        .andExpect(jsonPath("$.updated_at").isNotEmpty());
  }

  @Test
  void keepsEveryOptionTheSiteTicked() throws Exception {
    save(
            OPTIONS,
            """
            {"county": "Dublin", "sort_by": "name", "care_types": ["dementia", "respite"],
             "room_types": ["en-suite"], "facilities": ["garden"], "activities": ["music", "bingo"]}
            """)
        .andExpect(status().isOk());

    read(OPTIONS)
        .andExpect(jsonPath("$.preferences.care_types", contains("dementia", "respite")))
        .andExpect(jsonPath("$.preferences.room_types[0]").value("en-suite"))
        .andExpect(jsonPath("$.preferences.facilities[0]").value("garden"))
        .andExpect(jsonPath("$.preferences.activities[1]").value("bingo"));
  }

  // One saved search per account: saving again is a change of it, not a second one.
  @Test
  void replacesTheSavedSearchOnEachSave() throws Exception {
    save(REPLACED, CORK).andExpect(status().isOk());
    save(
            REPLACED,
            """
            {"county": "Mayo", "care_types": ["palliative"]}
            """)
        .andExpect(status().isOk());

    read(REPLACED)
        .andExpect(jsonPath("$.preferences.county").value("Mayo"))
        .andExpect(jsonPath("$.preferences.care_types[0]").value("palliative"));
    assertThat(rows(REPLACED)).isEqualTo(1);
    assertThat(accounts(REPLACED)).isEqualTo(1);
  }

  @Test
  void forgetsTheSavedSearch() throws Exception {
    save(FORGOTTEN, CORK).andExpect(status().isOk());

    mvc.perform(
            delete("/preferences")
                .header("X-ClearCare-Sub", FORGOTTEN)
                .header("X-ClearCare-Token", TOKEN))
        .andExpect(status().isNoContent());

    read(FORGOTTEN).andExpect(jsonPath("$.preferences").value(nullValue()));
    assertThat(rows(FORGOTTEN)).isZero();
    assertThat(accounts(FORGOTTEN)).isEqualTo(1);
  }

  @Test
  void keepsEachAccountsSearchApart() throws Exception {
    save(ONE_ACCOUNT, CORK).andExpect(status().isOk());
    save(
            ANOTHER_ACCOUNT,
            """
            {"county": "Galway"}
            """)
        .andExpect(status().isOk());

    read(ONE_ACCOUNT).andExpect(jsonPath("$.preferences.county").value("Cork"));
    read(ANOTHER_ACCOUNT).andExpect(jsonPath("$.preferences.county").value("Galway"));
  }

  @Test
  void refusesARequestThatIsNotTheSites() throws Exception {
    mvc.perform(get("/preferences").header("X-ClearCare-Sub", REFUSED))
        .andExpect(status().isUnauthorized())
        .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON));
    mvc.perform(
            get("/preferences")
                .header("X-ClearCare-Sub", REFUSED)
                .header("X-ClearCare-Token", "not-the-token"))
        .andExpect(status().isUnauthorized());
    mvc.perform(get("/preferences").header("X-ClearCare-Token", TOKEN))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void refusesASearchTheSiteDoesNotOffer() throws Exception {
    save(
            REFUSED,
            """
            {"sort_by": "newest"}
            """)
        .andExpect(status().isBadRequest())
        .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.detail").value("sort_by must be name or latest_inspection"));

    save(
            REFUSED,
            """
            {"care_types": ["Dementia care"]}
            """)
        .andExpect(status().isBadRequest());
    save(
            REFUSED,
            """
            {"care_types": ["../etc/passwd"]}
            """)
        .andExpect(status().isBadRequest());

    assertThat(rows(REFUSED)).isZero();
  }

  private ResultActions read(String account) throws Exception {
    return mvc.perform(
        get("/preferences")
            .header("X-ClearCare-Sub", account)
            .header("X-ClearCare-Token", TOKEN));
  }

  private ResultActions save(String account, String body) throws Exception {
    return mvc.perform(
        put("/preferences")
            .header("X-ClearCare-Sub", account)
            .header("X-ClearCare-Token", TOKEN)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  private static long rows(String account) throws SQLException {
    return count(
        "SELECT count(*) FROM clearcare.user_preferences p"
            + " JOIN clearcare.users u ON u.id = p.user_id"
            + " WHERE u.cognito_sub = '"
            + account
            + "'");
  }

  // The account row outlives the saved search: forgetting a search is not leaving.
  private static long accounts(String account) throws SQLException {
    return count(
        "SELECT count(*) FROM clearcare.users WHERE cognito_sub = '" + account + "'");
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
