package ie.clearcare.api.amenities;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
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
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;

/**
 * GET /centres/{centre_id}/amenities against PostgreSQL with the roles and schema from this
 * repository, logged in as clearcare_api. The cases follow api/openapi.yaml.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class CentreAmenitiesTest {

  // Maven runs the tests in api/.
  private static final Path REPOSITORY = Path.of("..");
  // roles.sql needs a password for each role; only the API's is used here.
  private static final String PASSWORD = UUID.randomUUID().toString();

  private static final String ELM_HALL = "34";
  private static final String NO_AMENITIES = "99";

  // The migrations the amenities view needs, in order, as Flyway runs them (ADR-0010).
  private static final List<String> MIGRATIONS =
      List.of(
          "db/V1__register_entries.sql",
          "db/V2__inspection_reports.sql",
          "db/V3__inspection_report_views.sql",
          "db/V5__inspection_report_text.sql",
          "db/V11__report_amenities.sql");

  // A register snapshot, so that the centres exist (db/V1), and two reports of Elm Hall
  // (db/V2). The newer report has two extractions, as after a re-run with a new prompt, and the
  // older one has one. The API serves the newest extraction of the newest report.
  private static final String SEED =
      """
      INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)
      VALUES (
          'older_persons_register',
          'https://www.hiqa.ie/centre/export/older_persons_register.csv?_format=csv',
          'c24a105a5f1df7026a9e1a86977273f9987b07c3137fb21fed8265a18cd90337',
          '2026-10-05 06:12:54.481+00');

      INSERT INTO clearcare.centre (centre_id) VALUES ('34'), ('99');

      INSERT INTO clearcare.register_entry (
          source_file_id, centre_id, source_record, centre_name, address, county, eircode,
          maximum_occupancy, provider_name, hiqa_url, extracted_at, extractor_version)
      VALUES
          (1, '34', 1, 'Elm Hall Nursing Home', 'Elm Hall, Celbridge, W23 P6EX', 'Kildare',
           'W23P6EX', 62, NULL, 'https://www.hiqa.ie/test/34', now(), 'test'),
          (1, '99', 2, 'No Amenities Nursing Home', 'Main Street, Cork', 'Cork',
           NULL, 30, NULL, 'https://www.hiqa.ie/test/99', now(), 'test');

      INSERT INTO clearcare.register_publication (source_file_id, published_at)
      VALUES (1, now());

      INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)
      VALUES
          ('inspection-reports', 'https://www.hiqa.ie/sites/default/files/2025-06/elm-hall.pdf',
           '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b',
           '2025-06-01 09:15:00+00'),
          ('inspection-reports', 'https://www.hiqa.ie/sites/default/files/2026-06/elm-hall.pdf',
           'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35',
           '2026-06-01 09:15:00+00');

      INSERT INTO clearcare.inspection_report (
          source_file_id, centre_id, centre_code, centre_name, provider_name, address,
          inspection_type, inspection_date, fieldwork_id, residents)
      VALUES
          (2, '34', 'OSV-0000034', 'Elm Hall Nursing Home', 'Springwood Nursing Homes Limited',
           'Elm Hall, Celbridge, W23 P6EX', 'Unannounced', '2025-05-13', 'MON-0040001', 50),
          (3, '34', 'OSV-0000034', 'Elm Hall Nursing Home', 'Springwood Nursing Homes Limited',
           'Elm Hall, Celbridge, W23 P6EX', 'Unannounced', '2026-05-13', 'MON-0050709', 48);

      INSERT INTO clearcare.report_amenities (
          report_id, care_types, room_types, has_outdoor_space, activities, has_transport,
          has_chapel_or_religious_services, special_units, dining_notes, other_notes,
          extractor_version, model)
      VALUES
          (1, '{long-term residential}', '{single room}', NULL, '{}', NULL, NULL, '{}', '',
           'From the older report.', 'amenities-v0', 'gpt-4o-mini'),
          (2, '{long-term residential}', '{single room}', TRUE, '{}', NULL, NULL, '{}', '',
           'First reading of the newer report.', 'amenities-v0', 'gpt-4o-mini'),
          (2, '{long-term residential,"dementia care"}', '{single room,en-suite}', TRUE,
           '{physiotherapy,"music therapy"}', NULL, TRUE, '{"memory care unit"}',
           'Meals are served in the dining room.', 'Views over the garden.', 'amenities-v1',
           'gpt-4o-mini');
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
  static void loadSchemaAndSeed() throws Exception {
    for (String migration : MIGRATIONS) {
      execute("SET ROLE clearcare_owner;\n" + Files.readString(REPOSITORY.resolve(migration)));
    }
    execute(SEED);
  }

  @Test
  void returnsTheNewestExtractionOfTheNewestReport() throws Exception {
    // Strict: any other property fails the test.
    mvc.perform(get("/centres/" + ELM_HALL + "/amenities"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {
                      "centre_id": "34",
                      "amenities": {
                        "report_id": 2,
                        "inspection_date": "2026-05-13",
                        "care_types": ["long-term residential", "dementia care"],
                        "room_types": ["single room", "en-suite"],
                        "has_outdoor_space": true,
                        "activities": ["physiotherapy", "music therapy"],
                        "has_transport": null,
                        "has_chapel_or_religious_services": true,
                        "special_units": ["memory care unit"],
                        "dining_notes": "Meals are served in the dining room.",
                        "other_notes": "Views over the garden.",
                        "extractor_version": "amenities-v1",
                        "model": "gpt-4o-mini"
                      }
                    }
                    """,
                    JsonCompareMode.STRICT));
  }

  @Test
  void returnsNullAmenitiesForACentreThatHasNone() throws Exception {
    mvc.perform(get("/centres/" + NO_AMENITIES + "/amenities"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.centre_id", is(NO_AMENITIES)))
        .andExpect(jsonPath("$.amenities").value(nullValue()));
  }

  // A value that is not a centre ID at all is not found either, rather than refused.
  @ParameterizedTest
  @ValueSource(strings = {"999", "elm-hall"})
  void doesNotFindACentreThatIsNotInTheSnapshot(String centreId) throws Exception {
    mvc.perform(get("/centres/" + centreId + "/amenities"))
        .andExpect(status().isNotFound())
        .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {"title": "Not Found", "status": 404,
                     "detail": "The register has no centre with this centre_id.",
                     "instance": "/centres/%s/amenities"}
                    """
                        .formatted(centreId)));
  }

  private static void execute(String sql) throws SQLException {
    try (Connection connection = database.createConnection("");
        Statement statement = connection.createStatement()) {
      statement.execute(sql);
    }
  }
}
