package ie.clearcare.api.centres;

import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;

/**
 * GET /centres and GET /centres/{centre_id} against PostgreSQL with the roles and schema from this
 * repository, logged in as clearcare_api. The cases follow api/openapi.yaml.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class CentreSearchTest {

  // Maven runs the tests in api/.
  private static final Path REPOSITORY = Path.of("..");
  // roles.sql needs a password for each role; only the API's is used here.
  private static final String PASSWORD = UUID.randomUUID().toString();

  private static final String ELM_HALL = "34";
  private static final String ARAS = "456";
  private static final String ST_JOSEPHS_CORK = "9";
  private static final String ST_JOSEPHS_DUBLIN = "10";
  private static final String STELLA_MARIS = "77";

  // Search order: by folded name in code order, so "st josephs" comes before "stella maris",
  // then by centre_id as a number, so 9 comes before 10.
  private static final List<String> EVERY_CENTRE =
      List.of(ARAS, ELM_HALL, ST_JOSEPHS_CORK, ST_JOSEPHS_DUBLIN, STELLA_MARIS);

  // One register snapshot, as the pipeline loads it. fetched_at has a fraction of a second,
  // which the API leaves out.
  private static final String SNAPSHOT =
      """
      INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)
      VALUES (
          'older_persons_register',
          'https://www.hiqa.ie/centre/export/older_persons_register.csv?_format=csv',
          'c24a105a5f1df7026a9e1a86977273f9987b07c3137fb21fed8265a18cd90337',
          '2026-10-05 06:12:54.481+00');

      INSERT INTO clearcare.centre (centre_id) VALUES ('34'), ('456'), ('9'), ('10'), ('77');

      INSERT INTO clearcare.register_entry (
          source_file_id, centre_id, source_record, centre_name, address, county, eircode,
          maximum_occupancy, provider_name, hiqa_url, extracted_at, extractor_version)
      VALUES
          (1, '34', 1, 'Elm Hall Nursing Home',
           'Elm Hall Nursing Home, Loughlinstown Road, Celbridge, W23 P6EX', 'Kildare', 'W23P6EX',
           62, 'Springwood Nursing Homes Limited',
           'https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall-nursing-home', now(), 'test'),
          (1, '456', 2, 'Áras Ui Dhomhnaill Nursing Home', 'Main Street, Dublin 9', 'Dublin',
           NULL, 40, NULL, 'https://www.hiqa.ie/test/456', now(), 'test'),
          (1, '9', 3, 'St Joseph''s Nursing Home', 'Main Street, Cork', 'Cork',
           NULL, NULL, NULL, 'https://www.hiqa.ie/test/9', now(), 'test'),
          (1, '10', 4, 'St Joseph''s Nursing Home', 'Main Street, Dublin 6W, D6W FR27', 'Dublin',
           'D6WFR27', 30, NULL, 'https://www.hiqa.ie/test/10', now(), 'test'),
          (1, '77', 5, 'Stella Maris Nursing Home', 'Main Street, Galway', 'Galway',
           NULL, 25, NULL, 'https://www.hiqa.ie/test/77', now(), 'test');
      """;

  private static final String PUBLISH =
      "INSERT INTO clearcare.register_publication (source_file_id, published_at) VALUES (1, now())";

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

  // As the container's superuser. V1 runs as clearcare_owner, as Flyway runs it (ADR-0010).
  @BeforeAll
  static void loadAndPublishASnapshot() throws Exception {
    Path migration = REPOSITORY.resolve("db/V1__register_entries.sql");
    execute("SET ROLE clearcare_owner;\n" + Files.readString(migration));
    execute(SNAPSHOT);
    execute(PUBLISH);
  }

  @Test
  void returnsCentresWithTheSnapshotTheyCameFrom() throws Exception {
    // Strict: any other property, such as provider_name, fails the test.
    search("name=elm")
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {
                      "centres": [{
                        "centre_id": "34",
                        "centre_name": "Elm Hall Nursing Home",
                        "address": "Elm Hall Nursing Home, Loughlinstown Road, Celbridge, W23 P6EX",
                        "county": "Kildare",
                        "eircode": "W23P6EX",
                        "maximum_occupancy": 62,
                        "hiqa_url": "https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall-nursing-home"
                      }],
                      "page": 1,
                      "page_size": 20,
                      "total": 1,
                      "register_snapshot": {
                        "fetched_at": "2026-10-05T06:12:54Z",
                        "url": "https://www.hiqa.ie/centre/export/older_persons_register.csv?_format=csv",
                        "sha256": "c24a105a5f1df7026a9e1a86977273f9987b07c3137fb21fed8265a18cd90337"
                      }
                    }
                    """,
                    JsonCompareMode.STRICT));
  }

  @ParameterizedTest
  @MethodSource
  void findsCentres(String query, List<String> centreIds) throws Exception {
    search(query)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.centres[*].centre_id", is(centreIds)));
  }

  static Stream<Arguments> findsCentres() {
    return Stream.of(
        arguments("", EVERY_CENTRE),
        arguments("name=aras", List.of(ARAS)),
        arguments("name=hall elm", List.of(ELM_HALL)),
        // Only the start of a word matches.
        arguments("name=lm", List.of()),
        // St and Saint are different words, a known limit.
        arguments("name=saint joseph", List.of()),
        // The input is folded like the names.
        arguments("name=JOSEPH’S", List.of(ST_JOSEPHS_CORK, ST_JOSEPHS_DUBLIN)),
        // Input with no letters or digits is ignored.
        arguments("name=-", EVERY_CENTRE),
        arguments("address=celbridge", List.of(ELM_HALL)),
        arguments("eircode=w23 p6ex", List.of(ELM_HALL)),
        arguments("eircode=W23", List.of(ELM_HALL)),
        arguments("eircode=D6W", List.of(ST_JOSEPHS_DUBLIN)),
        arguments("county=Dublin", List.of(ARAS, ST_JOSEPHS_DUBLIN)),
        // A centre must match every parameter given.
        arguments("name=st joseph&county=Dublin", List.of(ST_JOSEPHS_DUBLIN)));
  }

  @ParameterizedTest
  @MethodSource
  void pagesThroughCentres(String query, List<String> centreIds) throws Exception {
    search(query)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.centres[*].centre_id", is(centreIds)))
        .andExpect(jsonPath("$.total").value(EVERY_CENTRE.size()));
  }

  static Stream<Arguments> pagesThroughCentres() {
    return Stream.of(
        arguments("page=2&page_size=2", List.of(ST_JOSEPHS_CORK, ST_JOSEPHS_DUBLIN)),
        // Past the last page.
        arguments("page=4&page_size=2", List.of()));
  }

  @ParameterizedTest
  @MethodSource
  void refusesBadParameters(String query, String detail) throws Exception {
    search(query)
        .andExpect(status().isBadRequest())
        .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {"title": "Bad Request", "status": 400, "detail": "%s"}
                    """
                        .formatted(detail)));
  }

  static Stream<Arguments> refusesBadParameters() {
    return Stream.of(
        arguments(
            "eircode=W2",
            "eircode must be a routing key such as W23 or a full Eircode such as W23 P6EX"),
        arguments("page_size=51", "page_size must be between 1 and 50"),
        arguments(
            "colour=red",
            "colour is not a parameter; use one of name, address, eircode, county, page,"
                + " page_size"),
        arguments("name=a&name=b", "name must be given only once"),
        arguments("page=0", "page must be a whole number of 1 or more"),
        arguments("county=dublin", "county must be spelt as on the register, such as Dublin"),
        arguments("name=" + "a".repeat(101), "name must be at most 100 characters"),
        arguments("name=\0", "name must not contain a NUL character"));
  }

  @Test
  void returnsOneCentreWithTheSnapshotItCameFrom() throws Exception {
    // Strict: the same fields as a search result, and no others.
    mvc.perform(get("/centres/" + ELM_HALL))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {
                      "centre": {
                        "centre_id": "34",
                        "centre_name": "Elm Hall Nursing Home",
                        "address": "Elm Hall Nursing Home, Loughlinstown Road, Celbridge, W23 P6EX",
                        "county": "Kildare",
                        "eircode": "W23P6EX",
                        "maximum_occupancy": 62,
                        "hiqa_url": "https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall-nursing-home"
                      },
                      "register_snapshot": {
                        "fetched_at": "2026-10-05T06:12:54Z",
                        "url": "https://www.hiqa.ie/centre/export/older_persons_register.csv?_format=csv",
                        "sha256": "c24a105a5f1df7026a9e1a86977273f9987b07c3137fb21fed8265a18cd90337"
                      }
                    }
                    """,
                    JsonCompareMode.STRICT));
  }

  // A value that is not a centre ID at all is not found either, rather than refused.
  @ParameterizedTest
  @ValueSource(strings = {"999", "elm-hall"})
  void doesNotFindACentreThatIsNotInTheSnapshot(String centreId) throws Exception {
    mvc.perform(get("/centres/" + centreId))
        .andExpect(status().isNotFound())
        .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {"title": "Not Found", "status": 404,
                     "detail": "The register has no centre with this centre_id.",
                     "instance": "/centres/%s"}
                    """
                        .formatted(centreId)));
  }

  @ParameterizedTest
  @ValueSource(strings = {"/centres", "/centres/" + ELM_HALL})
  void isUnavailableUntilASnapshotIsPublished(String path) throws Exception {
    execute("DELETE FROM clearcare.register_publication");
    try {
      mvc.perform(get(path))
          .andExpect(status().isServiceUnavailable())
          .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
          .andExpect(
              content()
                  .json(
                      """
                      {"title": "Service Unavailable", "status": 503,
                       "detail": "The register has not been loaded yet."}
                      """));
    } finally {
      execute(PUBLISH);
    }
  }

  private ResultActions search(String query) throws Exception {
    return mvc.perform(get("/centres?" + query));
  }

  private static void execute(String sql) throws SQLException {
    try (Connection connection = database.createConnection("");
        Statement statement = connection.createStatement()) {
      statement.execute(sql);
    }
  }
}
