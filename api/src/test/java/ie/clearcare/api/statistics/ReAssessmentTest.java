package ie.clearcare.api.statistics;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;

/**
 * GET /statistics/re-assessment against PostgreSQL with the roles and schema from this repository,
 * logged in as clearcare_api. The expected counts are worked out by hand from SEED.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ReAssessmentTest {

  // Maven runs the tests in api/.
  private static final Path REPOSITORY = Path.of("..");
  // roles.sql needs a password for each role; only the API's is used here.
  private static final String PASSWORD = UUID.randomUUID().toString();

  // The migrations, in order, as Flyway runs them (ADR-0010).
  private static final List<String> MIGRATIONS =
      List.of(
          "db/V1__register_entries.sql",
          "db/V2__inspection_reports.sql",
          "db/V3__inspection_report_views.sql",
          "db/V4__re_assessment.sql");

  // Three reports of centre 34 and one of centre 99, each from its own stored PDF. Report 1 is
  // paired with report 2, and report 2 with report 3; reports 3 and 4 have no later report.
  //
  //   report 1: Regulation 5, 6, 8 Compliant; 15 Not compliant; 16 Substantially compliant
  //   report 2: Regulation 5 Compliant; 15 Substantially compliant; 23 Not compliant
  //   report 3: Regulation 15 Not compliant; 23 Compliant
  //   report 4: Regulation 9 Not compliant
  private static final String SEED =
      """
      INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)
      SELECT 'inspection-reports', 'https://www.hiqa.ie/test/report-' || n || '.pdf',
             repeat(n::text, 64), '2026-06-01 09:15:00+00'
      FROM generate_series(1, 4) AS n;

      INSERT INTO clearcare.centre (centre_id) VALUES ('34'), ('99');

      INSERT INTO clearcare.inspection_report (
          source_file_id, centre_id, centre_code, centre_name, address, inspection_date,
          fieldwork_id)
      VALUES
          (1, '34', 'OSV-0000034', 'Elm Hall', 'Celbridge', '2024-03-05', 'MON-1'),
          (2, '34', 'OSV-0000034', 'Elm Hall', 'Celbridge', '2025-04-10', 'MON-2'),
          (3, '34', 'OSV-0000034', 'Elm Hall', 'Celbridge', '2026-05-13', 'MON-3'),
          (4, '99', 'OSV-0000099', 'Oak Lodge', 'Cork', '2025-09-01', 'MON-4');

      INSERT INTO clearcare.inspection_regulation (report_id, regulation, title, judgment)
      VALUES
          (1, 'Regulation 5', 'Individual assessment and care plan', 'Compliant'),
          (1, 'Regulation 6', 'Health care', 'Compliant'),
          (1, 'Regulation 8', 'Protection', 'Compliant'),
          (1, 'Regulation 15', 'Staffing', 'Not compliant'),
          (1, 'Regulation 16', 'Training and staff development', 'Substantially compliant'),
          (2, 'Regulation 5', 'Individual assessment and care plan', 'Compliant'),
          (2, 'Regulation 15', 'Staffing', 'Substantially compliant'),
          (2, 'Regulation 23', 'Governance and management', 'Not compliant'),
          (3, 'Regulation 15', 'Staffing', 'Not compliant'),
          (3, 'Regulation 23', 'Governance and management', 'Compliant'),
          (4, 'Regulation 9', 'Residents'' rights', 'Not compliant');
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
  void countsWhatEachJudgmentBecameAtTheNextReport() throws Exception {
    // Strict: any other property fails the test.
    mvc.perform(get("/statistics/re-assessment"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {
                      "matrix": [
                        {
                          "judgment": "Compliant",
                          "compliant": 1,
                          "substantially_compliant": 0,
                          "not_compliant": 0,
                          "not_re_assessed": 3,
                          "no_later_report": 1,
                          "total": 5
                        },
                        {
                          "judgment": "Substantially compliant",
                          "compliant": 0,
                          "substantially_compliant": 0,
                          "not_compliant": 1,
                          "not_re_assessed": 1,
                          "no_later_report": 0,
                          "total": 2
                        },
                        {
                          "judgment": "Not compliant",
                          "compliant": 1,
                          "substantially_compliant": 1,
                          "not_compliant": 0,
                          "not_re_assessed": 0,
                          "no_later_report": 2,
                          "total": 4
                        }
                      ],
                      "re_check_rate": [
                        {
                          "judgment": "Compliant",
                          "with_later_report": 4,
                          "re_assessed": 1,
                          "rate": 0.25
                        },
                        {
                          "judgment": "Substantially compliant",
                          "with_later_report": 2,
                          "re_assessed": 1,
                          "rate": 0.5
                        },
                        {
                          "judgment": "Not compliant",
                          "with_later_report": 2,
                          "re_assessed": 2,
                          "rate": 1.0
                        }
                      ],
                      "coverage": {
                        "reports_loaded": 4,
                        "centres_with_two_or_more_reports": 1,
                        "reports_paired": 2,
                        "judgments_paired": 8
                      },
                      "data_date": "2026-05-13"
                    }
                    """,
                    JsonCompareMode.STRICT));
  }

  @Test
  void isUnavailableUntilAReportIsLoaded() throws Exception {
    execute("TRUNCATE clearcare.source_file, clearcare.centre RESTART IDENTITY CASCADE");
    try {
      mvc.perform(get("/statistics/re-assessment"))
          .andExpect(status().isServiceUnavailable())
          .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
          .andExpect(
              content()
                  .json(
                      """
                      {"title": "Service Unavailable", "status": 503,
                       "detail": "No inspection reports have been loaded yet."}
                      """));
    } finally {
      execute(SEED);
    }
  }

  private static void execute(String sql) throws SQLException {
    try (Connection connection = database.createConnection("");
        Statement statement = connection.createStatement()) {
      statement.execute(sql);
    }
  }
}
