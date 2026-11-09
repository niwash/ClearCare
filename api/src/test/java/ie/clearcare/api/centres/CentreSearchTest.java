package ie.clearcare.api.centres;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.ResultSet;
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
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import ie.clearcare.api.DatabaseImage;

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

  // The register migrations, the reports and their views, those that add
  // centre_phone and the contract prices, the amenities-v2 view, and the
  // centre locations and their view, as Flyway runs them (ADR-0010). The other
  // migrations are not needed here.
  private static final List<String> MIGRATIONS =
      List.of(
          "db/V1__register_entries.sql",
          "db/V2__inspection_reports.sql",
          "db/V3__inspection_report_views.sql",
          "db/V7__centre_phone.sql",
          "db/V8__contract_prices.sql",
          "db/V9__centre_contract_price_view.sql",
          "db/V10__centre_contract_price_home_type.sql",
          "db/V12__report_amenities_v2.sql",
          "db/V16__centre_location.sql",
          "db/V17__centre_point_view.sql");

  // One register snapshot, as the pipeline loads it. fetched_at has a fraction of a second,
  // which the API leaves out. Only Elm Hall has a centre_phone; the others have NULL, as every
  // row loaded before db/V7 does.
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
          maximum_occupancy, provider_name, hiqa_url, extracted_at, extractor_version,
          centre_phone)
      VALUES
          (1, '34', 1, 'Elm Hall Nursing Home',
           'Elm Hall Nursing Home, Loughlinstown Road, Celbridge, W23 P6EX', 'Kildare', 'W23P6EX',
           62, 'Springwood Nursing Homes Limited',
           'https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall-nursing-home', now(), 'test',
           '01 555 0123'),
          (1, '456', 2, 'Áras Ui Dhomhnaill Nursing Home', 'Main Street, Dublin 9', 'Dublin',
           NULL, 40, NULL, 'https://www.hiqa.ie/test/456', now(), 'test', NULL),
          (1, '9', 3, 'St Joseph''s Nursing Home', 'Main Street, Cork', 'Cork',
           NULL, NULL, NULL, 'https://www.hiqa.ie/test/9', now(), 'test', NULL),
          (1, '10', 4, 'St Joseph''s Nursing Home', 'Main Street, Dublin 6W, D6W FR07', 'Dublin',
           'D6WFR07', 30, NULL, 'https://www.hiqa.ie/test/10', now(), 'test', NULL),
          (1, '77', 5, 'Stella Maris Nursing Home', 'Main Street, Galway', 'Galway',
           NULL, 25, NULL, 'https://www.hiqa.ie/test/77', now(), 'test', NULL);
      """;

  private static final String PUBLISH =
      "INSERT INTO clearcare.register_publication (source_file_id, published_at) VALUES (1, now())";

  // The price lists the pipeline loads (db/V8): one list with three prices, a
  // second version of that same date, and a later list. Centres 77 and 10 have
  // no price at all.
  private static final String CONTRACT_PRICES =
      """
      INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)
      VALUES
          ('contract-price-public', 'https://www.hse.ie/nhss/one', repeat('a', 64), now()),
          ('contract-price-public', 'https://www.hse.ie/nhss/two', repeat('b', 64), now()),
          ('contract-price-private', 'https://www.hse.ie/section40/230', repeat('c', 64), now());

      INSERT INTO clearcare.contract_price_list (home_type, record_date, version, source_file_id)
      SELECT list.home_type, list.record_date, list.version, file.source_file_id
      FROM (VALUES
          ('public', DATE '2026-09-01', 1, 'https://www.hse.ie/nhss/one'),
          ('public', DATE '2026-09-01', 2, 'https://www.hse.ie/nhss/two'),
          ('private', DATE '2026-09-04', 1, 'https://www.hse.ie/section40/230')
      ) AS list (home_type, record_date, version, url)
      JOIN clearcare.source_file AS file ON file.url = list.url;

      INSERT INTO clearcare.contract_price (list_id, centre_id, price)
      SELECT list.id, prices.centre_id, prices.price
      FROM (VALUES
          ('public', DATE '2026-09-01', 1, '34', 1908.00),
          ('public', DATE '2026-09-01', 1, '456', 2100.00),
          ('public', DATE '2026-09-01', 1, '9', 1800.00),
          ('public', DATE '2026-09-01', 2, '456', 2200.00),
          ('private', DATE '2026-09-04', 1, '9', 1850.00)
      ) AS prices (home_type, record_date, version, centre_id, price)
      JOIN clearcare.contract_price_list AS list
          ON list.home_type = prices.home_type
          AND list.record_date = prices.record_date
          AND list.version = prices.version;
      """;

  // The reports the pipeline loads (db/V2), and the amenities-v2 extractions of
  // some of them (db/V12). The reports get ids 1 to 5 in the order of the rows:
  // Elm Hall has an older report that has been read (1) and a newer one that
  // has not (2), Áras one that has been read (3), St Joseph's in Cork one that
  // has been read and gives no inspection date (4), and Stella Maris one that
  // has not been read (5). St Joseph's in Dublin has no report. The extractions
  // leave out the evidence, which the search does not read.
  private static final String REPORTS =
      """
      INSERT INTO clearcare.source_file (source, url, sha256, fetched_at)
      VALUES
          ('inspection-reports', 'https://www.hiqa.ie/test/34-2025.pdf', repeat('1', 64), now()),
          ('inspection-reports', 'https://www.hiqa.ie/test/34-2026.pdf', repeat('2', 64), now()),
          ('inspection-reports', 'https://www.hiqa.ie/test/456.pdf', repeat('3', 64), now()),
          ('inspection-reports', 'https://www.hiqa.ie/test/9.pdf', repeat('4', 64), now()),
          ('inspection-reports', 'https://www.hiqa.ie/test/77.pdf', repeat('5', 64), now());

      INSERT INTO clearcare.inspection_report (
          source_file_id, centre_id, centre_code, centre_name, address, inspection_date,
          fieldwork_id)
      VALUES
          ((SELECT source_file_id FROM clearcare.source_file WHERE sha256 = repeat('1', 64)),
           '34', 'OSV-0000034', 'Elm Hall Nursing Home', 'Celbridge', '2025-05-13', 'MON-1'),
          ((SELECT source_file_id FROM clearcare.source_file WHERE sha256 = repeat('2', 64)),
           '34', 'OSV-0000034', 'Elm Hall Nursing Home', 'Celbridge', '2026-05-13', 'MON-2'),
          ((SELECT source_file_id FROM clearcare.source_file WHERE sha256 = repeat('3', 64)),
           '456', 'OSV-0000456', 'Áras Ui Dhomhnaill Nursing Home', 'Dublin 9', '2026-01-15',
           'MON-3'),
          ((SELECT source_file_id FROM clearcare.source_file WHERE sha256 = repeat('4', 64)),
           '9', 'OSV-0000009', 'St Joseph''s Nursing Home', 'Cork', NULL, 'MON-4'),
          ((SELECT source_file_id FROM clearcare.source_file WHERE sha256 = repeat('5', 64)),
           '77', 'OSV-0000077', 'Stella Maris Nursing Home', 'Galway', '2026-03-01', 'MON-5');

      INSERT INTO clearcare.report_amenities_v2 (
          report_id, amenities, file_name, hiqa_url, extractor_version, model, extracted_at)
      VALUES
          (1, '{"care_types": [{"item": "Long-term residential care"}, {"item": "Dementia care"}],
                "room_types": [{"item": "Single room"}],
                "activities": [{"item": "Bingo"}, {"item": "Men’s groups"}],
                "facilities": [{"item": "Garden"}]}',
           '34-2025.pdf', 'https://www.hiqa.ie/test/34-2025.pdf', 'amenities-v2', 'test', now()),
          (3, '{"care_types": [{"item": "Long-term residential care"}, {"item": "Respite care"}],
                "room_types": [{"item": "Twin/double room"}, {"item": "En-suite facilities"}],
                "activities": [{"item": "Music and singing"}, {"item": "Bingo"}],
                "facilities": [{"item": "Garden"}, {"item": "Lounge/day room"}]}',
           '456.pdf', 'https://www.hiqa.ie/test/456.pdf', 'amenities-v2', 'test', now()),
          (4, '{"care_types": [{"item": "Dementia care"}],
                "room_types": [{"item": "Multi-bed room"}],
                "activities": [],
                "facilities": [{"item": "Courtyard"}]}',
           '9.pdf', 'https://www.hiqa.ie/test/9.pdf', 'amenities-v2', 'test', now());
      """;

  // In the middle of Dublin.
  private static final String NEAR = "53.35,-6.26";

  // What a 400 says of any near that is not a valid one.
  private static final String NEAR_RULE =
      "near must be a latitude from -90 to 90 and a longitude from -180 to 180 in degrees, with at"
          + " most two decimal places, such as 53.35,-6.26";

  // The points the geocoder stores (db/V16), longitude first. Áras is 0.01° of latitude north of
  // NEAR, which is 1,113 m. St Joseph's in Cork's point is 60 days old, long past the 30 the view
  // allows, and Stella Maris has no point.
  private static final String LOCATIONS =
      """
      INSERT INTO clearcare.centre_location (centre_id, point, place_id, geocoded_at)
      VALUES
          ('456', ST_SetSRID(ST_MakePoint(-6.26, 53.36), 4326), 'aras', now()),
          ('34', ST_SetSRID(ST_MakePoint(-6.54, 53.34), 4326), 'elm-hall', now()),
          ('10', ST_SetSRID(ST_MakePoint(-6.30, 53.31), 4326), 'st-josephs-dublin', now()),
          ('9', ST_SetSRID(ST_MakePoint(-8.47, 51.90), 4326), 'st-josephs-cork',
           now() - interval '60 days');
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
  @Autowired private AmenityItemNames itemNames;

  // As the container's superuser. The migrations run as clearcare_owner, as Flyway runs them.
  @BeforeAll
  static void loadAndPublishASnapshot() throws Exception {
    for (String migration : MIGRATIONS) {
      execute("SET ROLE clearcare_owner;\n" + Files.readString(REPOSITORY.resolve(migration)));
    }
    execute(SNAPSHOT);
    execute(PUBLISH);
    execute(CONTRACT_PRICES);
    execute(REPORTS);
    execute(LOCATIONS);
  }

  @Test
  void returnsCentresWithTheSnapshotTheyCameFrom() throws Exception {
    // Strict: any other property, such as provider_name, centre_phone or the evidence, fails the
    // test. The facets have a key for every item, so they have tests of their own.
    ObjectNode result = (ObjectNode) searchResult("name=elm");
    assertThat(result.remove("facets")).isNotNull();
    assertThat(result)
        .isEqualTo(
            json.readTree(
                """
                {
                  "centres": [{
                    "centre_id": "34",
                    "centre_name": "Elm Hall Nursing Home",
                    "address": "Elm Hall Nursing Home, Loughlinstown Road, Celbridge, W23 P6EX",
                    "county": "Kildare",
                    "eircode": "W23P6EX",
                    "maximum_occupancy": 62,
                    "hiqa_url": "https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall-nursing-home",
                    "amenities": {
                      "report_id": 1,
                      "inspection_date": "2025-05-13",
                      "care_types": ["Long-term residential care", "Dementia care"],
                      "room_types": ["Single room"],
                      "activities": ["Bingo", "Men’s groups"],
                      "facilities": ["Garden"]
                    },
                    "fair_deal": true,
                    "latest_inspection": {"date": "2026-05-13"},
                    "distance_m": null
                  }],
                  "page": 1,
                  "page_size": 20,
                  "total": 1,
                  "register_snapshot": {
                    "fetched_at": "2026-10-05T06:12:54Z",
                    "url": "https://www.hiqa.ie/centre/export/older_persons_register.csv?_format=csv",
                    "sha256": "c24a105a5f1df7026a9e1a86977273f9987b07c3137fb21fed8265a18cd90337"
                  },
                  "sort": "name"
                }
                """));
  }

  @ParameterizedTest
  @MethodSource
  void describesWhatIsKnownOfEachCentre(String query, String centre) throws Exception {
    search(query)
        .andExpect(status().isOk())
        .andExpect(content().json("{\"centres\": [%s]}".formatted(centre)));
  }

  static Stream<Arguments> describesWhatIsKnownOfEachCentre() {
    return Stream.of(
        arguments(
            "county=Cork",
            """
            {"amenities": {"report_id": 4, "inspection_date": null},
             "fair_deal": true, "latest_inspection": {"date": null}}
            """),
        // Stella Maris has a report that has not been read.
        arguments(
            "county=Galway",
            """
            {"amenities": null, "fair_deal": false, "latest_inspection": {"date": "2026-03-01"}}
            """),
        // St Joseph's in Dublin has no report.
        arguments(
            "eircode=D6W",
            """
            {"amenities": null, "fair_deal": false, "latest_inspection": null}
            """));
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
        // Eircodes have no letter O, so an O is read as 0.
        arguments("eircode=d6w fro7", List.of(ST_JOSEPHS_DUBLIN)),
        arguments("county=Dublin", List.of(ARAS, ST_JOSEPHS_DUBLIN)),
        // A centre must match every parameter given.
        arguments("name=st joseph&county=Dublin", List.of(ST_JOSEPHS_DUBLIN)),
        // care_type, facility and activity: every value given. The centres whose reports have not
        // been read, St Joseph's in Dublin and Stella Maris, match none of them.
        arguments("care_type=Long-term residential care", List.of(ARAS, ELM_HALL)),
        arguments(
            "care_type=Long-term residential care&care_type=Dementia care", List.of(ELM_HALL)),
        arguments("facility=Garden", List.of(ARAS, ELM_HALL)),
        arguments("activity=Men’s groups", List.of(ELM_HALL)),
        arguments("county=Dublin&facility=Garden", List.of(ARAS)),
        // room_type: any value given.
        arguments("room_type=Single room", List.of(ELM_HALL)),
        arguments("room_type=Single room&room_type=Twin/double room", List.of(ARAS, ELM_HALL)),
        // A value given twice counts once.
        arguments("facility=Garden&facility=Garden", List.of(ARAS, ELM_HALL)),
        arguments("sort=name", EVERY_CENTRE));
  }

  // Newest inspection first. St Joseph's in Cork has a report without a date and St Joseph's in
  // Dublin none; both come last, in name order.
  @Test
  void sortsByTheLatestInspection() throws Exception {
    search("sort=latest_inspection")
        .andExpect(status().isOk())
        .andExpect(
            jsonPath(
                "$.centres[*].centre_id",
                is(List.of(ELM_HALL, STELLA_MARIS, ARAS, ST_JOSEPHS_CORK, ST_JOSEPHS_DUBLIN))))
        .andExpect(jsonPath("$.sort").value("latest_inspection"));
  }

  // Nearest first. St Joseph's in Cork, whose only point is too old, and Stella Maris, which has
  // none, come last, in name order.
  @Test
  void sortsByDistanceFromNear() throws Exception {
    search("near=" + NEAR + "&sort=distance")
        .andExpect(status().isOk())
        .andExpect(
            jsonPath(
                "$.centres[*].centre_id",
                is(List.of(ARAS, ST_JOSEPHS_DUBLIN, ELM_HALL, ST_JOSEPHS_CORK, STELLA_MARIS))))
        .andExpect(jsonPath("$.sort").value("distance"));
  }

  @Test
  void givesTheDistanceInWholeMetres() throws Exception {
    search("name=aras&near=" + NEAR)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.centres[0].distance_m").value(1113));
  }

  // near with another order: the centres in that order, with a distance for each centre that has a
  // point.
  @Test
  void givesDistancesInTheOrderAskedFor() throws Exception {
    search("near=" + NEAR)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.centres[*].centre_id", is(EVERY_CENTRE)))
        .andExpect(
            jsonPath(
                "$.centres[?(@.distance_m != null)].centre_id",
                is(List.of(ARAS, ELM_HALL, ST_JOSEPHS_DUBLIN))))
        .andExpect(jsonPath("$.sort").value("name"));
  }

  // Counted in UTC calendar days, as the geocoder deletes them (ADR-0027). St Joseph's in Dublin's
  // point is stamped 29 days ago early in the day, and St Joseph's in Cork's 30 days ago late in
  // the day: whatever the time now, Dublin's may be over 29 times 24 hours old and Cork's under 30
  // times 24. One transaction stamps them and reads the view, so now() is the same for both, and
  // rolling it back leaves the fixture as it was.
  @Test
  void servesOnlyPointsUnder30CalendarDaysOld() throws Exception {
    try (Connection connection = database.createConnection("");
        Statement statement = connection.createStatement()) {
      connection.setAutoCommit(false);
      try {
        statement.execute(
            """
            UPDATE clearcare.centre_location
            SET geocoded_at =
                ((now() AT TIME ZONE 'UTC')::date - 29 + time '00:01') AT TIME ZONE 'UTC'
            WHERE centre_id = '10';
            UPDATE clearcare.centre_location
            SET geocoded_at =
                ((now() AT TIME ZONE 'UTC')::date - 30 + time '23:59') AT TIME ZONE 'UTC'
            WHERE centre_id = '9';
            """);
        List<String> served = new ArrayList<>();
        try (ResultSet row =
            statement.executeQuery(
                "SELECT centre_id FROM clearcare.centre_point WHERE centre_id IN ('10', '9')")) {
          while (row.next()) {
            served.add(row.getString("centre_id"));
          }
        }
        assertThat(served).containsExactly(ST_JOSEPHS_DUBLIN);
      } finally {
        connection.rollback();
      }
    }
  }

  // near measures the centres, and orders them if asked, but leaves none of them out.
  @Test
  void countsTheSameWithNear() throws Exception {
    JsonNode withoutNear = searchResult("");
    JsonNode withNear = searchResult("near=" + NEAR + "&sort=distance");
    assertThat(withNear.get("total")).isEqualTo(withoutNear.get("total"));
    assertThat(withNear.get("facets")).isEqualTo(withoutNear.get("facets"));
  }

  // With no parameters every centre matches. Every item of every list is a key, with 0 for those
  // that no report mentions.
  @Test
  void countsEveryItemOfEveryList() throws Exception {
    JsonNode facets = searchResult("").get("facets");
    assertThat(facets.get("care_type").propertyNames())
        .containsExactlyInAnyOrderElementsOf(itemNames.careTypes());
    assertThat(facets.get("room_type").propertyNames())
        .containsExactlyInAnyOrderElementsOf(itemNames.roomTypes());
    assertThat(facets.get("facility").propertyNames())
        .containsExactlyInAnyOrderElementsOf(itemNames.facilities());
    assertThat(facets.get("activity").propertyNames())
        .containsExactlyInAnyOrderElementsOf(itemNames.activities());
    assertThat(facets.get("facility").get("Garden").asLong()).isEqualTo(2);
    assertThat(facets.get("facility").get("Gym").asLong()).isZero();
    // Áras, Elm Hall and St Joseph's in Cork have a contract price.
    assertThat(facets.get("fair_deal").asLong()).isEqualTo(3);
  }

  // Elm Hall matches. Áras is long-term residential care too, but has no single rooms.
  @Test
  void countsTheCentresThatWouldMatchWithEachItemAdded() throws Exception {
    JsonNode result = searchResult("care_type=Long-term residential care&room_type=Single room");
    assertThat(result.get("total").asLong()).isEqualTo(1);
    JsonNode facets = result.get("facets");
    // An item added to care_type, facility or activity keeps the matching centres that mention
    // it.
    assertThat(facets.get("care_type").get("Dementia care").asLong()).isEqualTo(1);
    assertThat(facets.get("care_type").get("Respite care").asLong()).isZero();
    assertThat(facets.get("activity").get("Men’s groups").asLong()).isEqualTo(1);
    // An item added to room_type also matches the centres that mention it and match the other
    // parameters: Áras for its twin rooms and en-suites, but not St Joseph's in Cork, which has
    // a multi-bed room but not long-term residential care.
    assertThat(facets.get("room_type"))
        .isEqualTo(
            json.readTree(
                """
                {"Single room": 1, "Twin/double room": 2, "Multi-bed room": 1,
                 "Shared room, occupancy unspecified": 1, "En-suite facilities": 2,
                 "Shared bathroom facilities": 1}
                """));
    assertThat(facets.get("fair_deal").asLong()).isEqualTo(1);
  }

  // Dementia care matches Elm Hall and St Joseph's in Cork, on one page or two.
  @ParameterizedTest
  @ValueSource(strings = {"page_size=1", "page=2&page_size=1", "page=3&page_size=1"})
  void countsTheSameFacetsOnEveryPage(String page) throws Exception {
    JsonNode onePage = searchResult("care_type=Dementia care").get("facets");
    assertThat(onePage.get("care_type").get("Dementia care").asLong()).isEqualTo(2);
    assertThat(searchResult("care_type=Dementia care&" + page).get("facets")).isEqualTo(onePage);
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
        // Words with no digit in their first three characters: their Os are not read as 0.
        arguments(
            "eircode=Doonane",
            "eircode must be a routing key such as W23 or a full Eircode such as W23 P6EX"),
        arguments(
            "eircode=Doonan1",
            "eircode must be a routing key such as W23 or a full Eircode such as W23 P6EX"),
        arguments("page_size=51", "page_size must be between 1 and 50"),
        arguments(
            "colour=red",
            "colour is not a parameter; use one of name, address, eircode, county, care_type,"
                + " room_type, facility, activity, near, sort, page, page_size"),
        arguments("name=a&name=b", "name must be given only once"),
        arguments("sort=name&sort=name", "sort must be given only once"),
        arguments("sort=newest", "sort must be name, latest_inspection or distance"),
        arguments("sort=distance", "sort=distance needs near, such as near=53.35,-6.26"),
        arguments("near=53.35", NEAR_RULE),
        arguments("near=90.01,-6.26", NEAR_RULE),
        arguments("near=53.35,-180.01", NEAR_RULE),
        // A third decimal place is about 100 m, more exact than the API accepts.
        arguments("near=53.35,-6.261", NEAR_RULE),
        arguments("near=53.35,-6.26&near=53.35,-6.26", "near must be given only once"),
        // Item names are exact, and each list has its own.
        arguments(
            "facility=garden",
            "facility must be an item name from the amenities-v2 list, such as Garden"),
        arguments(
            "care_type=Garden",
            "care_type must be an item name from the amenities-v2 list, such as General nursing"
                + " care"),
        arguments(
            "room_type=Single room&room_type=Suite",
            "room_type must be an item name from the amenities-v2 list, such as Single room"),
        arguments(
            "activity=",
            "activity must be an item name from the amenities-v2 list, such as Music and"
                + " singing"),
        arguments("page=0", "page must be a whole number of 1 or more"),
        arguments("county=dublin", "county must be spelt as on the register, such as Dublin"),
        arguments("name=" + "a".repeat(101), "name must be at most 100 characters"),
        arguments("name=\0", "name must not contain a NUL character"));
  }

  @Test
  void returnsOneCentreWithTheSnapshotItCameFrom() throws Exception {
    // Strict: the register fields, centre_phone, contract_price and home_type,
    // and no others.
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
                        "hiqa_url": "https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall-nursing-home",
                        "centre_phone": "01 555 0123"
                      },
                      "register_snapshot": {
                        "fetched_at": "2026-10-05T06:12:54Z",
                        "url": "https://www.hiqa.ie/centre/export/older_persons_register.csv?_format=csv",
                        "sha256": "c24a105a5f1df7026a9e1a86977273f9987b07c3137fb21fed8265a18cd90337"
                      },
                      "contract_price": 1908.00,
                      "home_type": "public"
                    }
                    """,
                    JsonCompareMode.STRICT));
  }

  @Test
  void returnsNullForACentreWithoutAPhone() throws Exception {
    mvc.perform(get("/centres/" + STELLA_MARIS))
        .andExpect(status().isOk())
        .andExpect(
            content()
                .json(
                    """
                    {"centre": {"centre_id": "77", "centre_phone": null}}
                    """));
  }

  @Test
  void returnsTheContractPriceInForce() throws Exception {
    mvc.perform(get("/centres/" + ELM_HALL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.contract_price").value(1908.00))
        .andExpect(jsonPath("$.home_type").value("public"));
  }

  // The view keeps the newest of a centre's prices: 456 has two versions of one
  // date, 9 a later list.
  @Test
  void returnsTheLatestVersionOfTheSameDate() throws Exception {
    mvc.perform(get("/centres/" + ARAS))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.contract_price").value(2200.00))
        .andExpect(jsonPath("$.home_type").value("public"));
  }

  // The home type follows the price: 9 is on both lists, and the private list
  // is the later one.
  @Test
  void returnsThePriceOfTheLatestList() throws Exception {
    mvc.perform(get("/centres/" + ST_JOSEPHS_CORK))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.contract_price").value(1850.00))
        .andExpect(jsonPath("$.home_type").value("private"));
  }

  @Test
  void returnsNoPriceWhenNoListHasTheCentre() throws Exception {
    mvc.perform(get("/centres/" + STELLA_MARIS))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.contract_price").value(nullValue()))
        .andExpect(jsonPath("$.home_type").value(nullValue()));
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

  // Read as bytes: the body is UTF-8, which the response's string form does not assume.
  private JsonNode searchResult(String query) throws Exception {
    byte[] body =
        search(query)
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andReturn()
            .getResponse()
            .getContentAsByteArray();
    return json.readTree(body);
  }

  private static void execute(String sql) throws SQLException {
    try (Connection connection = database.createConnection("");
        Statement statement = connection.createStatement()) {
      statement.execute(sql);
    }
  }
}
