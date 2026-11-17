package ie.clearcare.api.events;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
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
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import ie.clearcare.api.DatabaseImage;

/**
 * GET /centres/{centre_id}/events against PostgreSQL with the roles and schema from this
 * repository, logged in as clearcare_api. The cases follow api/openapi.yaml.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class CentreEventsTest {

  // Maven runs the tests in api/.
  private static final Path REPOSITORY = Path.of("..");
  // roles.sql needs a password for each role; only the API's is used here.
  private static final String PASSWORD = UUID.randomUUID().toString();

  private static final String ELM_HALL = "34";
  private static final String STELLA_MARIS = "77";
  private static final String NO_EVENTS = "99";

  // The register, the reports, the contract prices and their view, the register changes, the
  // listed reports, the thematic reports and the views over them, as Flyway runs them (ADR-0010).
  private static final List<String> MIGRATIONS =
      List.of(
          "db/V1__register_entries.sql",
          "db/V2__inspection_reports.sql",
          "db/V8__contract_prices.sql",
          "db/V9__centre_contract_price_view.sql",
          "db/V10__centre_contract_price_home_type.sql",
          "db/V21__register_changes.sql",
          "db/V22__listed_reports.sql",
          "db/V23__thematic_reports.sql",
          "db/V24__centre_events.sql");

  // A register snapshot, so that the centres exist (db/V1).
  private static final String REGISTER =
      """
      INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)
      VALUES (
          'older_persons_register',
          'https://www.hiqa.ie/centre/export/older_persons_register.csv?_format=csv',
          'c24a105a5f1df7026a9e1a86977273f9987b07c3137fb21fed8265a18cd90337',
          '2026-10-05 06:12:54.481+00');

      INSERT INTO clearcare.centre (centre_id) VALUES ('34'), ('77'), ('99');

      INSERT INTO clearcare.register_entry (
          source_file_id, centre_id, source_record, centre_name, address, county, eircode,
          maximum_occupancy, provider_name, hiqa_url, extracted_at, extractor_version)
      VALUES
          (1, '34', 1, 'Elm Hall Nursing Home', 'Elm Hall, Celbridge, W23 P6EX', 'Kildare',
           'W23P6EX', 62, NULL, 'https://www.hiqa.ie/test/34', now(), 'test'),
          (1, '77', 2, 'Stella Maris Nursing Home', 'Main Street, Galway', 'Galway',
           NULL, 25, NULL, 'https://www.hiqa.ie/test/77', now(), 'test'),
          (1, '99', 3, 'No Events Nursing Home', 'Main Street, Cork', 'Cork',
           NULL, 30, NULL, 'https://www.hiqa.ie/test/99', now(), 'test');
      """;

  private static final String PUBLISH =
      "INSERT INTO clearcare.register_publication (source_file_id, published_at) VALUES (1, now())";

  // Elm Hall's reports. Three files have been read: a regulation inspection HIQA lists (report 1),
  // one it no longer lists (report 2) and a thematic inspection. Report 1 gives 13 May as its
  // date; HIQA lists it under 12 May, and lists a file that has not been read under 13 May.
  // Regulation 16 is in report 1 twice, as the parser reads a few reports (db/V4), and counts
  // once. Two listed dates cannot be right: the year 0026, and a day after the report was
  // published. Stella Maris has one listed report.
  private static final String REPORTS =
      """
      INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)
      VALUES
          ('inspection_report', 'https://www.hiqa.ie/test/34-13-may-2026.pdf', repeat('a', 64),
           now()),
          ('inspection_report', 'https://www.hiqa.ie/test/34-20-june-2023.pdf', repeat('b', 64),
           now()),
          ('inspection_report', 'https://www.hiqa.ie/test/34-4-november-2025.pdf',
           repeat('c', 64), now()),
          ('inspection_report', 'https://www.hiqa.ie/test/34-follow-up.pdf', repeat('d', 64),
           now());

      INSERT INTO clearcare.inspection_report (
          source_file_id, centre_id, centre_code, centre_name, address, inspection_type,
          inspection_date, fieldwork_id)
      VALUES
          ((SELECT source_file_id FROM clearcare.source_file WHERE sha256 = repeat('a', 64)),
           '34', 'OSV-0000034', 'Elm Hall Nursing Home', 'Celbridge', 'Unannounced',
           '2026-05-13', 'MON-1'),
          ((SELECT source_file_id FROM clearcare.source_file WHERE sha256 = repeat('b', 64)),
           '34', 'OSV-0000034', 'Elm Hall Nursing Home', 'Celbridge', 'Announced',
           '2023-06-20', 'MON-2');

      INSERT INTO clearcare.inspection_regulation (report_id, regulation, title, judgment)
      VALUES
          (1, 'Regulation 15', 'Staffing', 'Compliant'),
          (1, 'Regulation 16', 'Training', 'Not compliant'),
          (1, 'Regulation 17', 'Premises', 'Substantially compliant'),
          (1, 'Regulation 23', 'Governance', 'Compliant'),
          (1, 'Regulation 16', 'Training', 'Not Compliant'),
          (2, 'Regulation 15', 'Staffing', 'Compliant');

      INSERT INTO clearcare.thematic_report (
          source_file_id, centre_id, centre_code, inspection_type, inspection_date,
          fieldwork_id, overall_judgment)
      VALUES
          ((SELECT source_file_id FROM clearcare.source_file WHERE sha256 = repeat('c', 64)),
           '34', 'OSV-0000034', 'Unannounced', '2025-11-04', 'MON-3',
           'Substantially Compliant');

      INSERT INTO clearcare.listed_report (
          centre_id, url, file_name, inspection_date, published_date, report_type, sha256)
      VALUES
          ('34', 'https://www.hiqa.ie/test/34-13-may-2026.pdf', '34-13-may-2026.pdf',
           '2026-05-12', '2026-06-20', 'Nursing Homes', repeat('a', 64)),
          ('34', 'https://www.hiqa.ie/test/34-follow-up.pdf', '34-follow-up.pdf',
           '2026-05-13', '2026-06-27', 'Nursing Homes', repeat('d', 64)),
          ('34', 'https://www.hiqa.ie/test/34-4-november-2025.pdf', '34-4-november-2025.pdf',
           '2025-11-04', '2025-12-10', 'Nursing Homes', repeat('c', 64)),
          ('34', 'https://www.hiqa.ie/test/34-9-january-2026.pdf', '34-9-january-2026.pdf',
           '0026-01-09', '2026-04-15', 'Nursing Homes', NULL),
          ('34', 'https://www.hiqa.ie/test/34-4-november-2026.pdf', '34-4-november-2026.pdf',
           '2026-11-04', '2026-03-16', 'Nursing Homes', NULL),
          ('34', 'https://www.hiqa.ie/test/34-7-march-2024.pdf', '34-7-march-2024.pdf',
           '2024-03-07', '2024-04-19', 'Nursing Homes', NULL),
          ('77', 'https://www.hiqa.ie/test/77-2-february-2026.pdf', '77-2-february-2026.pdf',
           '2026-02-02', '2026-03-30', 'Nursing Homes', NULL);
      """;

  // The register changes the pipeline found (db/V21): one of each kind for Elm Hall, a name
  // change that an earlier version of the rules found, and Stella Maris's registration.
  private static final String REGISTER_CHANGES =
      """
      INSERT INTO clearcare.register_change (
          centre_id, kind, change_date, shown_on, snapshot_sha256, condition_number,
          before_text, after_text, beds_before, beds_after, registered_until,
          registration_number, rules_version)
      VALUES
          ('34', 'registration', '2024-06-01', '2026-09-30', repeat('1', 64), NULL,
           NULL, NULL, NULL, NULL, '2027-05-31', 'REG-0030001', 'rules-v1'),
          ('34', 'provider', '2026-10-20', '2026-10-20', repeat('2', 64), NULL,
           'Springwood Nursing Homes Limited', 'Elm Care Limited', NULL, NULL, NULL, NULL,
           'rules-v1'),
          ('34', 'name', '2026-10-20', '2026-10-20', repeat('2', 64), NULL,
           'Elm Hall', 'Elm Hall Nursing Home', NULL, NULL, NULL, NULL, 'rules-v1'),
          ('34', 'beds', '2026-10-20', '2026-10-20', repeat('2', 64), NULL,
           NULL, NULL, 60, 62, NULL, NULL, 'rules-v1'),
          ('34', 'condition_added', '2026-10-20', '2026-10-20', repeat('2', 64), 4,
           NULL, 'No resident shall be admitted to Room 12.', NULL, NULL, NULL, NULL,
           'rules-v1'),
          ('34', 'note_added', '2026-10-20', '2026-10-20', repeat('2', 64), NULL,
           NULL, 'A notice of proposed decision has issued.', NULL, NULL, NULL, NULL,
           'rules-v1'),
          ('34', 'condition_changed', '2026-11-02', '2026-11-02', repeat('3', 64), 4,
           'No resident shall be admitted to Room 12.',
           'No resident shall be admitted to Rooms 12 and 14.', NULL, NULL, NULL, NULL,
           'rules-v1'),
          ('34', 'condition_removed', '2026-11-09', '2026-11-09', repeat('4', 64), 4,
           'No resident shall be admitted to Rooms 12 and 14.', NULL, NULL, NULL, NULL, NULL,
           'rules-v1'),
          ('34', 'note_removed', '2026-11-09', '2026-11-09', repeat('4', 64), NULL,
           'A notice of proposed decision has issued.', NULL, NULL, NULL, NULL, NULL,
           'rules-v1'),
          ('34', 'name', '2026-10-21', '2026-10-21', repeat('5', 64), NULL,
           'Found by other rules', 'Elm Hall', NULL, NULL, NULL, NULL, 'rules-v0'),
          ('77', 'registration', '2025-03-01', '2026-09-30', repeat('1', 64), NULL,
           NULL, NULL, NULL, NULL, '2028-02-29', 'REG-0030002', 'rules-v1');
      """;

  // The price lists the pipeline loads (db/V8). Elm Hall's price is 1,800 in the first list,
  // 1,850 in the next, 1,908 in a second version of that list's date, and still 1,908 in the
  // last. Stella Maris is in one list only.
  private static final String CONTRACT_PRICES =
      """
      INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)
      VALUES
          ('contract-price-public', 'https://www.hse.ie/nhss/2025', repeat('6', 64), now()),
          ('contract-price-public', 'https://www.hse.ie/nhss/2026', repeat('7', 64), now()),
          ('contract-price-public', 'https://www.hse.ie/nhss/2026-again', repeat('8', 64), now()),
          ('contract-price-public', 'https://www.hse.ie/nhss/2026-10', repeat('9', 64), now());

      INSERT INTO clearcare.contract_price_list (home_type, record_date, version, source_file_id)
      SELECT 'public', list.record_date, list.version, file.source_file_id
      FROM (VALUES
          (DATE '2025-09-01', 1, 'https://www.hse.ie/nhss/2025'),
          (DATE '2026-09-01', 1, 'https://www.hse.ie/nhss/2026'),
          (DATE '2026-09-01', 2, 'https://www.hse.ie/nhss/2026-again'),
          (DATE '2026-10-01', 1, 'https://www.hse.ie/nhss/2026-10')
      ) AS list (record_date, version, url)
      JOIN clearcare.source_file AS file ON file.url = list.url;

      INSERT INTO clearcare.contract_price (list_id, centre_id, price)
      SELECT list.id, prices.centre_id, prices.price
      FROM (VALUES
          (DATE '2025-09-01', 1, '34', 1800.00),
          (DATE '2026-09-01', 1, '34', 1850.00),
          (DATE '2026-09-01', 2, '34', 1908.00),
          (DATE '2026-10-01', 1, '34', 1908.00),
          (DATE '2026-10-01', 1, '77', 2100.00)
      ) AS prices (record_date, version, centre_id, price)
      JOIN clearcare.contract_price_list AS list
          ON list.record_date = prices.record_date AND list.version = prices.version;
      """;

  @Container
  static final PostgreSQLContainer database = DatabaseImage.newDatabase(PASSWORD);

  // The user name comes from application.properties.
  @DynamicPropertySource
  static void connectAsTheApi(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", database::getJdbcUrl);
    registry.add("spring.datasource.password", () -> PASSWORD);
  }

  @Autowired private MockMvc mvc;
  @Autowired private JsonMapper json;

  // As the container's superuser. The migrations run as clearcare_owner, as Flyway runs them.
  @BeforeAll
  static void loadSchemaAndSeed() throws Exception {
    for (String migration : MIGRATIONS) {
      execute("SET ROLE clearcare_owner;\n" + Files.readString(REPOSITORY.resolve(migration)));
    }
    execute(REGISTER);
    execute(PUBLISH);
    execute(REPORTS);
    execute(REGISTER_CHANGES);
    execute(CONTRACT_PRICES);
  }

  // Strict: an event has its kind, its date and that kind's fields, and no others.
  @ParameterizedTest
  @MethodSource
  void givesEachKindItsFields(String kind, String events) throws Exception {
    assertThat(eventsOfKind(ELM_HALL, kind)).containsExactlyElementsOf(json.readTree(events));
  }

  static Stream<Arguments> givesEachKindItsFields() {
    return Stream.of(
        // One judgment per regulation: Regulation 16, listed twice, counts once (db/V14).
        arguments(
            "inspection",
            """
            [{"kind": "inspection", "date": "2026-05-13", "inspection_type": "Unannounced",
              "published_date": "2026-06-20", "report_id": 1,
              "report_url": "https://www.hiqa.ie/test/34-13-may-2026.pdf",
              "compliant": 2, "substantially_compliant": 1, "not_compliant": 1},
             {"kind": "inspection", "date": "2023-06-20", "inspection_type": "Announced",
              "published_date": null, "report_id": 2,
              "report_url": "https://www.hiqa.ie/test/34-20-june-2023.pdf",
              "compliant": 1, "substantially_compliant": 0, "not_compliant": 0}]
            """),
        arguments(
            "thematic_inspection",
            """
            [{"kind": "thematic_inspection", "date": "2025-11-04",
              "inspection_type": "Unannounced", "published_date": "2025-12-10",
              "overall_judgment": "Substantially Compliant",
              "report_url": "https://www.hiqa.ie/test/34-4-november-2025.pdf"}]
            """),
        arguments(
            "unread_report",
            """
            [{"kind": "unread_report", "date": "2026-05-13", "published_date": "2026-06-27",
              "report_url": "https://www.hiqa.ie/test/34-follow-up.pdf"},
             {"kind": "unread_report", "date": null, "published_date": "2026-04-15",
              "report_url": "https://www.hiqa.ie/test/34-9-january-2026.pdf"},
             {"kind": "unread_report", "date": null, "published_date": "2026-03-16",
              "report_url": "https://www.hiqa.ie/test/34-4-november-2026.pdf"},
             {"kind": "unread_report", "date": "2024-03-07", "published_date": "2024-04-19",
              "report_url": "https://www.hiqa.ie/test/34-7-march-2024.pdf"}]
            """),
        arguments(
            "registration",
            """
            [{"kind": "registration", "date": "2024-06-01", "registered_until": "2027-05-31"}]
            """),
        arguments(
            "provider",
            """
            [{"kind": "provider", "date": "2026-10-20",
              "before": "Springwood Nursing Homes Limited", "after": "Elm Care Limited"}]
            """),
        arguments(
            "name",
            """
            [{"kind": "name", "date": "2026-10-20", "before": "Elm Hall",
              "after": "Elm Hall Nursing Home"}]
            """),
        arguments(
            "beds",
            """
            [{"kind": "beds", "date": "2026-10-20", "before": 60, "after": 62}]
            """),
        arguments(
            "condition_added",
            """
            [{"kind": "condition_added", "date": "2026-10-20", "condition_number": 4,
              "text": "No resident shall be admitted to Room 12."}]
            """),
        // The words that are gone.
        arguments(
            "condition_removed",
            """
            [{"kind": "condition_removed", "date": "2026-11-09", "condition_number": 4,
              "text": "No resident shall be admitted to Rooms 12 and 14."}]
            """),
        arguments(
            "condition_changed",
            """
            [{"kind": "condition_changed", "date": "2026-11-02", "condition_number": 4,
              "before": "No resident shall be admitted to Room 12.",
              "after": "No resident shall be admitted to Rooms 12 and 14."}]
            """),
        arguments(
            "note_added",
            """
            [{"kind": "note_added", "date": "2026-10-20",
              "text": "A notice of proposed decision has issued."}]
            """),
        arguments(
            "note_removed",
            """
            [{"kind": "note_removed", "date": "2026-11-09",
              "text": "A notice of proposed decision has issued."}]
            """),
        // The list's record_date. Two versions of one date: the later version's change first.
        arguments(
            "price",
            """
            [{"kind": "price", "date": "2026-09-01", "before": 1850.00, "after": 1908.00,
              "home_type": "public"},
             {"kind": "price", "date": "2026-09-01", "before": 1800.00, "after": 1850.00,
              "home_type": "public"}]
            """));
  }

  // Newest first. On one day, inspections come first, then the register changes in the order of
  // the register's columns, then prices. An event with no date is placed by the day its report
  // was published: 15 April and 16 March here.
  @Test
  void listsEventsNewestFirstAndOneDaysEventsInAFixedOrderOfKinds() throws Exception {
    List<String> kindsAndDates = new ArrayList<>();
    for (JsonNode event : events(ELM_HALL)) {
      JsonNode date = event.get("date");
      kindsAndDates.add(
          event.get("kind").asString() + " " + (date.isNull() ? "none" : date.asString()));
    }

    assertThat(kindsAndDates)
        .containsExactly(
            "condition_removed 2026-11-09",
            "note_removed 2026-11-09",
            "condition_changed 2026-11-02",
            "provider 2026-10-20",
            "name 2026-10-20",
            "beds 2026-10-20",
            "condition_added 2026-10-20",
            "note_added 2026-10-20",
            "price 2026-09-01",
            "price 2026-09-01",
            "inspection 2026-05-13",
            "unread_report 2026-05-13",
            "unread_report none",
            "unread_report none",
            "thematic_inspection 2025-11-04",
            "registration 2024-06-01",
            "unread_report 2024-03-07",
            "inspection 2023-06-20");
  }

  // HIQA lists report 1 under 12 May and another file under 13 May, the date report 1 prints.
  // The report belongs with its own file, and the other file stays unread.
  @Test
  void joinsAListedReportToWhatWasReadFromItsFileNotToAReportOfTheSameDate() throws Exception {
    assertThat(eventsOfKind(ELM_HALL, "inspection").getFirst())
        .isEqualTo(
            json.readTree(
                """
                {"kind": "inspection", "date": "2026-05-13", "inspection_type": "Unannounced",
                 "published_date": "2026-06-20", "report_id": 1,
                 "report_url": "https://www.hiqa.ie/test/34-13-may-2026.pdf",
                 "compliant": 2, "substantially_compliant": 1, "not_compliant": 1}
                """));
    assertThat(eventsOfKind(ELM_HALL, "unread_report").getFirst())
        .isEqualTo(
            json.readTree(
                """
                {"kind": "unread_report", "date": "2026-05-13", "published_date": "2026-06-27",
                 "report_url": "https://www.hiqa.ie/test/34-follow-up.pdf"}
                """));
  }

  // The year 0026 is before HIQA was set up in 2007, and 4 November 2026 is after the report was
  // published.
  @ParameterizedTest
  @ValueSource(strings = {"34-9-january-2026.pdf", "34-4-november-2026.pdf"})
  void givesNoDateWhenTheListedOneCannotBeRight(String fileName) throws Exception {
    assertThat(eventOfReport(ELM_HALL, "https://www.hiqa.ie/test/" + fileName).get("date").isNull())
        .isTrue();
  }

  // HIQA takes old reports off a centre's page. One that was read before then is still an
  // event, with no published date.
  @Test
  void keepsAReadReportThatHiqaNoLongerLists() throws Exception {
    JsonNode event = eventOfReport(ELM_HALL, "https://www.hiqa.ie/test/34-20-june-2023.pdf");

    assertThat(event.get("kind").asString()).isEqualTo("inspection");
    assertThat(event.get("published_date").isNull()).isTrue();
  }

  // Elm Hall is in four lists: its first price is no event, and neither is the last list, where
  // the price is the same as before. Stella Maris has one price only.
  @Test
  void givesAPriceOnlyWhenItDiffersFromTheCentresPriceInTheListBefore() throws Exception {
    assertThat(eventsOfKind(ELM_HALL, "price")).hasSize(2);
    assertThat(eventsOfKind(STELLA_MARIS, "price")).isEmpty();
  }

  // The seed has a name change found by rules-v0. Rows of two versions describe the same
  // snapshots, so only one version is served.
  @Test
  void servesTheRegisterChangesOfOneRulesVersion() throws Exception {
    assertThat(eventsOfKind(ELM_HALL, "name")).hasSize(1);
    assertThat(eventsOfKind(ELM_HALL, "name").getFirst().get("before").asString())
        .isEqualTo("Elm Hall");
  }

  @Test
  void givesACentreOnlyItsOwnEvents() throws Exception {
    // Strict: Stella Maris's two events, and none of Elm Hall's.
    mvc.perform(get("/centres/" + STELLA_MARIS + "/events"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {
                      "centre_id": "77",
                      "events": [
                        {"kind": "unread_report", "date": "2026-02-02",
                         "published_date": "2026-03-30",
                         "report_url": "https://www.hiqa.ie/test/77-2-february-2026.pdf"},
                        {"kind": "registration", "date": "2025-03-01",
                         "registered_until": "2028-02-29"}
                      ]
                    }
                    """,
                    JsonCompareMode.STRICT));
  }

  @Test
  void returnsNoEventsForACentreThatHasNone() throws Exception {
    mvc.perform(get("/centres/" + NO_EVENTS + "/events"))
        .andExpect(status().isOk())
        .andExpect(
            content()
                .json(
                    """
                    {"centre_id": "99", "events": []}
                    """,
                    JsonCompareMode.STRICT));
  }

  // A value that is not a centre ID at all is not found either, rather than refused.
  @ParameterizedTest
  @ValueSource(strings = {"999", "elm-hall"})
  void doesNotFindACentreThatIsNotInTheSnapshot(String centreId) throws Exception {
    mvc.perform(get("/centres/" + centreId + "/events"))
        .andExpect(status().isNotFound())
        .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {"title": "Not Found", "status": 404,
                     "detail": "The register has no centre with this centre_id.",
                     "instance": "/centres/%s/events"}
                    """
                        .formatted(centreId)));
  }

  @Test
  void isUnavailableUntilASnapshotIsPublished() throws Exception {
    execute("DELETE FROM clearcare.register_publication");
    try {
      mvc.perform(get("/centres/" + ELM_HALL + "/events"))
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

  // The centre's events, in the order the route gives them.
  private JsonNode events(String centreId) throws Exception {
    byte[] body =
        mvc.perform(get("/centres/" + centreId + "/events"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsByteArray();
    return json.readTree(body).get("events");
  }

  private List<JsonNode> eventsOfKind(String centreId, String kind) throws Exception {
    List<JsonNode> ofKind = new ArrayList<>();
    for (JsonNode event : events(centreId)) {
      if (event.get("kind").asString().equals(kind)) {
        ofKind.add(event);
      }
    }
    return ofKind;
  }

  private JsonNode eventOfReport(String centreId, String reportUrl) throws Exception {
    for (JsonNode event : events(centreId)) {
      if (event.has("report_url") && event.get("report_url").asString().equals(reportUrl)) {
        return event;
      }
    }
    throw new AssertionError("No event has the report_url " + reportUrl);
  }

  private static void execute(String sql) throws SQLException {
    try (Connection connection = database.createConnection("");
        Statement statement = connection.createStatement()) {
      statement.execute(sql);
    }
  }
}
