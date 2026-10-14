package ie.clearcare.api.reports;

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
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;

/**
 * GET /centres/{centre_id}/reports and GET /reports/{report_id} against PostgreSQL with the roles
 * and schema from this repository, logged in as clearcare_api. The cases follow api/openapi.yaml.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class CentreReportsTest {

  // Maven runs the tests in api/.
  private static final Path REPOSITORY = Path.of("..");
  // roles.sql needs a password for each role; only the API's is used here.
  private static final String PASSWORD = UUID.randomUUID().toString();

  private static final String ELM_HALL = "34";
  private static final String NO_REPORTS = "99";

  // The migrations, in order, as Flyway runs them (ADR-0010).
  private static final List<String> MIGRATIONS =
      List.of(
          "db/V1__register_entries.sql",
          "db/V2__inspection_reports.sql",
          "db/V3__inspection_report_views.sql");

  // A register snapshot, so that the centre exists (db/V1), and one parsed report of it
  // (db/V2), as the pipeline loads it. The report's PDF is a second stored file (ADR-0007),
  // and fetched_at has a fraction of a second, which the API leaves out.
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
          (1, '99', 2, 'No Reports Nursing Home', 'Main Street, Cork', 'Cork',
           NULL, 30, NULL, 'https://www.hiqa.ie/test/99', now(), 'test');

      INSERT INTO clearcare.register_publication (source_file_id, published_at)
      VALUES (1, now());

      INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)
      VALUES (
          'inspection-reports',
          'https://www.hiqa.ie/sites/default/files/2026-06/elm-hall.pdf',
          '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b',
          '2026-06-01 09:15:00.75+00');

      INSERT INTO clearcare.inspection_report (
          source_file_id, centre_id, centre_code, centre_name, provider_name, address,
          inspection_type, inspection_date, fieldwork_id, residents)
      VALUES (2, '34', 'OSV-0000034', 'Elm Hall Nursing Home',
              'Springwood Nursing Homes Limited', 'Elm Hall, Celbridge, W23 P6EX',
              'Unannounced', '2026-05-13', 'MON-0050709', 48);

      INSERT INTO clearcare.inspection_inspector (report_id, date, start_time, end_time, name, role)
      VALUES
          (1, '2026-05-13', '09:00', '17:20', 'A. Inspector', 'Lead'),
          (1, '2026-05-14', NULL, NULL, 'B. Inspector', NULL);

      INSERT INTO clearcare.inspection_regulation (report_id, regulation, title, judgment)
      VALUES
          (1, 'Regulation 15', 'Staffing', 'Compliant'),
          (1, 'Regulation 16', 'Training', 'Not Compliant');

      INSERT INTO clearcare.inspection_compliance_item (
          report_id, regulation, requirement, judgment, risk_rating, date_to_comply)
      VALUES (1, 'Regulation 16(1)(a)', 'Staff receive appropriate training.',
              'Not Compliant', 'Orange', '2026-09-01');
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
  void returnsTheCentresReportsWithHowMuchTheyHold() throws Exception {
    // Strict: any other property fails the test.
    mvc.perform(get("/centres/" + ELM_HALL + "/reports"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {
                      "centre_id": "34",
                      "reports": [{
                        "report_id": 1,
                        "inspection_type": "Unannounced",
                        "inspection_date": "2026-05-13",
                        "fieldwork_id": "MON-0050709",
                        "residents": 48,
                        "inspector_count": 2,
                        "regulation_count": 2,
                        "compliance_item_count": 1
                      }]
                    }
                    """,
                    JsonCompareMode.STRICT));
  }

  @Test
  void returnsOneReportWithEverythingItPrinted() throws Exception {
    // Strict: the record groups are in the order the report prints them.
    mvc.perform(get("/reports/1"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {
                      "report": {
                        "report_id": 1,
                        "centre_id": "34",
                        "centre_code": "OSV-0000034",
                        "centre_name": "Elm Hall Nursing Home",
                        "provider_name": "Springwood Nursing Homes Limited",
                        "address": "Elm Hall, Celbridge, W23 P6EX",
                        "inspection_type": "Unannounced",
                        "inspection_date": "2026-05-13",
                        "fieldwork_id": "MON-0050709",
                        "residents": 48,
                        "report_file": {
                          "sha256": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
                          "url": "https://www.hiqa.ie/sites/default/files/2026-06/elm-hall.pdf",
                          "fetched_at": "2026-06-01T09:15:00Z"
                        },
                        "inspectors": [
                          {
                            "date": "2026-05-13",
                            "start_time": "09:00:00",
                            "end_time": "17:20:00",
                            "name": "A. Inspector",
                            "role": "Lead"
                          },
                          {
                            "date": "2026-05-14",
                            "start_time": null,
                            "end_time": null,
                            "name": "B. Inspector",
                            "role": null
                          }
                        ],
                        "regulations": [
                          {
                            "regulation": "Regulation 15",
                            "title": "Staffing",
                            "judgment": "Compliant"
                          },
                          {
                            "regulation": "Regulation 16",
                            "title": "Training",
                            "judgment": "Not Compliant"
                          }
                        ],
                        "compliance_items": [{
                          "regulation": "Regulation 16(1)(a)",
                          "requirement": "Staff receive appropriate training.",
                          "judgment": "Not Compliant",
                          "risk_rating": "Orange",
                          "date_to_comply": "2026-09-01"
                        }]
                      }
                    }
                    """,
                    JsonCompareMode.STRICT));
  }

  @Test
  void returnsNoReportsForACentreThatHasNone() throws Exception {
    mvc.perform(get("/centres/" + NO_REPORTS + "/reports"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.centre_id", is(NO_REPORTS)))
        .andExpect(jsonPath("$.reports", is(List.of())));
  }

  // A value that is not a centre ID at all is not found either, rather than refused.
  @ParameterizedTest
  @ValueSource(strings = {"999", "elm-hall"})
  void doesNotFindACentreThatIsNotInTheSnapshot(String centreId) throws Exception {
    mvc.perform(get("/centres/" + centreId + "/reports"))
        .andExpect(status().isNotFound())
        .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {"title": "Not Found", "status": 404,
                     "detail": "The register has no centre with this centre_id.",
                     "instance": "/centres/%s/reports"}
                    """
                        .formatted(centreId)));
  }

  // A value that is not a report ID is not found either, rather than refused.
  @ParameterizedTest
  @ValueSource(strings = {"999", "elm-hall", "99999999999999999999"})
  void doesNotFindAReportThatIsNotStored(String reportId) throws Exception {
    mvc.perform(get("/reports/" + reportId))
        .andExpect(status().isNotFound())
        .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {"title": "Not Found", "status": 404,
                     "detail": "There is no report with this report_id.",
                     "instance": "/reports/%s"}
                    """
                        .formatted(reportId)));
  }

  @Test
  void isUnavailableUntilASnapshotIsPublished() throws Exception {
    execute("DELETE FROM clearcare.register_publication");
    try {
      mvc.perform(get("/centres/" + ELM_HALL + "/reports"))
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
      execute(
          "INSERT INTO clearcare.register_publication (source_file_id, published_at)"
              + " VALUES (1, now())");
    }
  }

  private static void execute(String sql) throws SQLException {
    try (Connection connection = database.createConnection("");
        Statement statement = connection.createStatement()) {
      statement.execute(sql);
    }
  }
}
