package ie.clearcare.api.findings;

import static org.hamcrest.Matchers.contains;
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

import ie.clearcare.api.DatabaseImage;

/**
 * GET /centres/{centre_id}/findings against PostgreSQL with the roles and schema from this
 * repository, logged in as clearcare_api. The cases follow api/openapi.yaml; the re-assessment
 * itself is the view's, tested in pipeline/tests/test_finding_re_assessment.py.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class CentreFindingsTest {

  // Maven runs the tests in api/.
  private static final Path REPOSITORY = Path.of("..");
  // roles.sql needs a password for each role; only the API's is used here.
  private static final String PASSWORD = UUID.randomUUID().toString();

  private static final String ELM_HALL = "34";
  private static final String ASH_LODGE = "35";
  private static final String NO_REPORTS = "99";

  // The migrations the findings need, in order, as Flyway runs them (ADR-0010).
  private static final List<String> MIGRATIONS =
      List.of(
          "db/V1__register_entries.sql",
          "db/V2__inspection_reports.sql",
          "db/V3__inspection_report_views.sql",
          "db/V5__inspection_report_text.sql",
          "db/V6__inspection_commitments.sql",
          "db/V14__finding_re_assessment.sql");

  // A register snapshot, so that the centres exist (db/V1). Elm Hall has two reports (db/V2): the
  // first has two findings and the second judges one of them again. Ash Lodge has one report
  // whose text and commitments are at other versions besides the ones the API serves (db/V5,
  // db/V6). Text rows get ids 1 to 8 and reports 1 to 3, in the order they are inserted.
  private static final String SEED =
      """
      INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)
      VALUES (
          'older_persons_register',
          'https://www.hiqa.ie/centre/export/older_persons_register.csv?_format=csv',
          'c24a105a5f1df7026a9e1a86977273f9987b07c3137fb21fed8265a18cd90337',
          '2026-10-05 06:12:54+00');

      INSERT INTO clearcare.centre (centre_id) VALUES ('34'), ('35'), ('99');

      INSERT INTO clearcare.register_entry (
          source_file_id, centre_id, source_record, centre_name, address, county, eircode,
          maximum_occupancy, provider_name, hiqa_url, extracted_at, extractor_version)
      VALUES
          (1, '34', 1, 'Elm Hall Nursing Home', 'Elm Hall, Celbridge, W23 P6EX', 'Kildare',
           'W23P6EX', 62, NULL, 'https://www.hiqa.ie/test/34', now(), 'test'),
          (1, '35', 2, 'Ash Lodge Nursing Home', 'Ash Lodge, Naas', 'Kildare',
           NULL, 40, NULL, 'https://www.hiqa.ie/test/35', now(), 'test'),
          (1, '99', 3, 'No Reports Nursing Home', 'Main Street, Cork', 'Cork',
           NULL, 30, NULL, 'https://www.hiqa.ie/test/99', now(), 'test');

      INSERT INTO clearcare.register_publication (source_file_id, published_at)
      VALUES (1, now());

      INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)
      VALUES
          ('inspection-reports', 'https://www.hiqa.ie/sites/default/files/2024-10/elm-hall.pdf',
           repeat('a', 64), '2024-10-01 09:00:00+00'),
          ('inspection-reports', 'https://www.hiqa.ie/sites/default/files/2025-02/elm-hall.pdf',
           repeat('b', 64), '2025-02-01 09:00:00+00'),
          ('inspection-reports', 'https://www.hiqa.ie/sites/default/files/2025-04/ash-lodge.pdf',
           repeat('c', 64), '2025-04-01 09:00:00+00');

      INSERT INTO clearcare.inspection_report (
          source_file_id, centre_id, centre_code, centre_name, address, inspection_date,
          fieldwork_id)
      VALUES
          (2, '34', 'OSV-0000034', 'Elm Hall Nursing Home', 'Elm Hall, Celbridge',
           '2024-08-16', 'MON-0040211'),
          (3, '34', 'OSV-0000034', 'Elm Hall Nursing Home', 'Elm Hall, Celbridge',
           '2025-01-11', 'MON-0045568'),
          (4, '35', 'OSV-0000035', 'Ash Lodge Nursing Home', 'Ash Lodge, Naas',
           '2025-03-04', 'MON-0046001');

      INSERT INTO clearcare.inspection_regulation (report_id, regulation, title, judgment)
      VALUES
          (1, 'Regulation 28', 'Fire precautions', 'Not compliant'),
          (1, 'Regulation 9', 'Residents'' rights', 'Substantially compliant'),
          (1, 'Regulation 15', 'Staffing', 'Compliant'),
          (2, 'Regulation 28', 'Fire precautions', 'Compliant'),
          (3, 'Regulation 2', 'Interpretation', 'Substantially compliant'),
          (3, 'Regulation 28', 'Fire precautions', 'Not compliant');

      INSERT INTO clearcare.inspection_compliance_item (
          report_id, regulation, requirement, judgment, risk_rating, date_to_comply)
      VALUES
          (1, 'Regulation 28(1)(a)', 'Adequate precautions against the risk of fire.',
           'Not Compliant', 'Yellow', '2024-10-16'),
          (1, 'Regulation 28(1)(e)', 'Fire drills at suitable intervals.',
           'Not Compliant', 'Orange', '2024-09-29'),
          (3, 'Regulation 2(1)', 'A requirement of Regulation 2.',
           'Substantially Compliant', 'Yellow', '2025-05-01'),
          (3, 'Regulation 28(1)(a)', 'Adequate precautions against the risk of fire.',
           'Not Compliant', 'Red', '2025-03-18');

      INSERT INTO clearcare.inspection_report_text (
          report_id, kind, regulation, first_page, last_page, text, page_offsets,
          extractor_version)
      VALUES
          (1, 'narrative', 'Regulation 28', 11, 12,
           'Regulation 28: Fire precautions The ductwork had not been cleaned. Judgment: Not compliant',
           '{32}', 'text-v1'),
          (1, 'response', 'Regulation 28', 18, 18,
           'Regulation 28: Fire precautions Not Compliant The ductwork will be cleaned by 30/09/2024. Staff will attend fire training.',
           '{}', 'text-v1'),
          (2, 'narrative', 'Regulation 28', 11, 11,
           'Regulation 28: Fire precautions Fire drills were held regularly. Judgment: Compliant',
           '{}', 'text-v1'),
          (3, 'narrative', 'Regulation 2', 5, 5,
           'Regulation 2: Interpretation As extracted at text-v1.', '{}', 'text-v1'),
          (3, 'narrative', 'Regulation 2', 5, 5,
           'Regulation 2: Interpretation As extracted at text-v2.', '{}', 'text-v2'),
          (3, 'narrative', 'Regulation 28', 6, 6,
           'Regulation 28: Fire precautions As extracted at text-v2.', '{}', 'text-v2'),
          (3, 'response', 'Regulation 2', 20, 20,
           'Regulation 2: Interpretation Substantially Compliant Records will be reviewed monthly.',
           '{}', 'text-v1'),
          (3, 'response', 'Regulation 28', 21, 21,
           'Regulation 28: Fire precautions Not Compliant Doors will be replaced by 31/05/2025.',
           '{}', 'text-v1');

      INSERT INTO clearcare.inspection_commitment (
          response_id, start_offset, end_offset, text, stated_deadline, stated_deadline_text,
          deadline_precision, page, last_page, splitter_version)
      VALUES
          (2, 46, 89, 'The ductwork will be cleaned by 30/09/2024.', '2024-09-30', '30/09/2024',
           'day', 18, 18, 'rules-v3'),
          (2, 90, 122, 'Staff will attend fire training.', NULL, NULL, NULL, 18, 18, 'rules-v3'),
          (7, 53, 86, 'Records will be reviewed monthly.', NULL, NULL, NULL, 20, 20, 'rules-v3'),
          (8, 46, 83, 'Doors will be replaced by 31/05/2025.', '2025-05-31', '31/05/2025',
           'day', 21, 21, 'rules-v2');
      """;

  // roles.sql runs from the image's init scripts, as it does for a new local database.
  @Container
  static final PostgreSQLContainer database =
      new PostgreSQLContainer(DatabaseImage.POSTGIS)
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
  void returnsEachFindingWithItsTextAndReAssessment() throws Exception {
    // Strict: any other property fails the test. Regulation 9 comes before Regulation 28 by
    // number, and has no text at all.
    mvc.perform(get("/centres/" + ELM_HALL + "/findings"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {
                      "centre_id": "34",
                      "findings": [
                        {
                          "report_id": 1,
                          "inspection_date": "2024-08-16",
                          "report_url": "https://www.hiqa.ie/sites/default/files/2024-10/elm-hall.pdf",
                          "regulation": "Regulation 9",
                          "title": "Residents' rights",
                          "judgment": "Substantially compliant",
                          "compliance_items": [],
                          "inspector": null,
                          "provider_response": null,
                          "stated_deadlines": null,
                          "re_assessment": {
                            "status": "not re-assessed",
                            "report_id": null,
                            "inspection_date": null,
                            "report_url": null,
                            "judgment": null,
                            "reports_between": null,
                            "inspector": null
                          }
                        },
                        {
                          "report_id": 1,
                          "inspection_date": "2024-08-16",
                          "report_url": "https://www.hiqa.ie/sites/default/files/2024-10/elm-hall.pdf",
                          "regulation": "Regulation 28",
                          "title": "Fire precautions",
                          "judgment": "Not compliant",
                          "compliance_items": [
                            {
                              "regulation": "Regulation 28(1)(a)",
                              "risk_rating": "Yellow",
                              "date_to_comply": "2024-10-16"
                            },
                            {
                              "regulation": "Regulation 28(1)(e)",
                              "risk_rating": "Orange",
                              "date_to_comply": "2024-09-29"
                            }
                          ],
                          "inspector": {
                            "text": "Regulation 28: Fire precautions The ductwork had not been cleaned. Judgment: Not compliant",
                            "first_page": 11,
                            "last_page": 12
                          },
                          "provider_response": {
                            "text": "Regulation 28: Fire precautions Not Compliant The ductwork will be cleaned by 30/09/2024. Staff will attend fire training.",
                            "first_page": 18,
                            "last_page": 18
                          },
                          "stated_deadlines": [{
                            "text": "The ductwork will be cleaned by 30/09/2024.",
                            "stated_deadline": "2024-09-30",
                            "stated_deadline_text": "30/09/2024",
                            "deadline_precision": "day",
                            "page": 18,
                            "last_page": 18
                          }],
                          "re_assessment": {
                            "status": "re-assessed",
                            "report_id": 2,
                            "inspection_date": "2025-01-11",
                            "report_url": "https://www.hiqa.ie/sites/default/files/2025-02/elm-hall.pdf",
                            "judgment": "Compliant",
                            "reports_between": 0,
                            "inspector": {
                              "text": "Regulation 28: Fire precautions Fire drills were held regularly. Judgment: Compliant",
                              "first_page": 11,
                              "last_page": 11
                            }
                          }
                        }
                      ]
                    }
                    """,
                    JsonCompareMode.STRICT));
  }

  // A newer extraction is not served until the API pins it, and an older one is never served in
  // place of missing text.
  @Test
  void servesTextOnlyAtThePinnedExtractorVersion() throws Exception {
    mvc.perform(get("/centres/" + ASH_LODGE + "/findings"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.findings[*].regulation", contains("Regulation 2", "Regulation 28")))
        .andExpect(
            jsonPath(
                "$.findings[0].inspector.text",
                is("Regulation 2: Interpretation As extracted at text-v1.")))
        .andExpect(jsonPath("$.findings[1].inspector", nullValue()));
  }

  // Regulation 2 is a prefix of Regulation 28(1)(a), but not its number.
  @Test
  void givesEachFindingTheComplianceItemsOfItsOwnRegulation() throws Exception {
    mvc.perform(get("/centres/" + ASH_LODGE + "/findings"))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.findings[0].compliance_items[*].regulation", contains("Regulation 2(1)")))
        .andExpect(
            jsonPath(
                "$.findings[1].compliance_items[*].regulation", contains("Regulation 28(1)(a)")));
  }

  // Regulation 2's response was split and states no deadline. Regulation 28's was split only by
  // another splitter version, which says nothing about what this one would find.
  @Test
  void statedDeadlinesAreEmptyAfterASplitAndNullWithoutOne() throws Exception {
    mvc.perform(get("/centres/" + ASH_LODGE + "/findings"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.findings[0].stated_deadlines", is(List.of())))
        .andExpect(jsonPath("$.findings[1].provider_response.first_page", is(21)))
        .andExpect(jsonPath("$.findings[1].stated_deadlines", nullValue()));
  }

  @Test
  void returnsNoFindingsForACentreThatHasNone() throws Exception {
    mvc.perform(get("/centres/" + NO_REPORTS + "/findings"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.centre_id", is(NO_REPORTS)))
        .andExpect(jsonPath("$.findings", is(List.of())));
  }

  // A value that is not a centre ID at all is not found either, rather than refused.
  @ParameterizedTest
  @ValueSource(strings = {"999", "elm-hall"})
  void doesNotFindACentreThatIsNotInTheSnapshot(String centreId) throws Exception {
    mvc.perform(get("/centres/" + centreId + "/findings"))
        .andExpect(status().isNotFound())
        .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {"title": "Not Found", "status": 404,
                     "detail": "The register has no centre with this centre_id.",
                     "instance": "/centres/%s/findings"}
                    """
                        .formatted(centreId)));
  }

  @Test
  void isUnavailableUntilASnapshotIsPublished() throws Exception {
    execute("DELETE FROM clearcare.register_publication");
    try {
      mvc.perform(get("/centres/" + ELM_HALL + "/findings"))
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
