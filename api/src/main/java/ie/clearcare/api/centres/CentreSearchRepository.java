package ie.clearcare.api.centres;

import java.math.BigDecimal;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads centres from the views the clearcare_api role can read (db/V1, db/V3, db/V7, db/V10,
 * db/V12, db/V17, db/V24).
 */
@Repository
class CentreSearchRepository {

  private static final String REGISTER_SNAPSHOT =
      "SELECT fetched_at, url, sha256 FROM clearcare.published_register_snapshot";

  // centre_summary is every centre of the published snapshot with the item names of each list its
  // latest extracted report mentions, in the report's order (empty when it has none), whether a
  // contract price is stored for it, and its newest report, in the order of the centre's report
  // list (CentreReportsRepository).
  //
  // Every parameter that is not null must match. For name and address, each word of the folded
  // input must be the start of a word of the folded column. search_key leaves only a-z, 0-9 and
  // single spaces, so a word cannot act as a LIKE wildcard, and input with no words left is
  // ignored. A full Eircode has all seven characters, so as a prefix it matches only itself.
  // care_type, facility and activity need every name given; every array contains the empty one, so
  // a list that was not given matches every centre. room_type needs any name given, and is applied
  // last because its facets count from the centres that match everything else.
  private static final String MATCHING =
      """
      WITH centre_summary AS (
          SELECT
              centre_search.centre_id,
              centre_search.centre_name,
              centre_search.address,
              centre_search.county,
              centre_search.eircode,
              centre_search.maximum_occupancy,
              centre_search.hiqa_url,
              centre_search.name_key,
              centre_search.address_key,
              amenities_v2.report_id AS amenities_report_id,
              amenities_v2.inspection_date AS amenities_inspection_date,
              ARRAY(
                  SELECT list.entry ->> 'item'
                  FROM jsonb_array_elements(amenities_v2.amenities -> 'care_types')
                      WITH ORDINALITY AS list (entry, ordinality)
                  ORDER BY list.ordinality) AS care_types,
              ARRAY(
                  SELECT list.entry ->> 'item'
                  FROM jsonb_array_elements(amenities_v2.amenities -> 'room_types')
                      WITH ORDINALITY AS list (entry, ordinality)
                  ORDER BY list.ordinality) AS room_types,
              ARRAY(
                  SELECT list.entry ->> 'item'
                  FROM jsonb_array_elements(amenities_v2.amenities -> 'activities')
                      WITH ORDINALITY AS list (entry, ordinality)
                  ORDER BY list.ordinality) AS activities,
              ARRAY(
                  SELECT list.entry ->> 'item'
                  FROM jsonb_array_elements(amenities_v2.amenities -> 'facilities')
                      WITH ORDINALITY AS list (entry, ordinality)
                  ORDER BY list.ordinality) AS facilities,
              contract_price.centre_id IS NOT NULL AS fair_deal,
              latest_report.report_id AS latest_report_id,
              latest_report.inspection_date AS latest_inspection_date
          FROM clearcare.centre_search
          LEFT JOIN clearcare.centre_amenities_v2 AS amenities_v2
              ON amenities_v2.centre_id = centre_search.centre_id
          LEFT JOIN clearcare.centre_contract_price AS contract_price
              ON contract_price.centre_id = centre_search.centre_id
          LEFT JOIN LATERAL (
              SELECT report_id, inspection_date
              FROM clearcare.centre_report
              WHERE centre_report.centre_id = centre_search.centre_id
              ORDER BY inspection_date DESC NULLS LAST, report_id
              LIMIT 1
          ) AS latest_report ON true
      ),
      matching_other_than_room_type AS (
          SELECT * FROM centre_summary
          WHERE NOT EXISTS (
                  SELECT FROM unnest(string_to_array(clearcare.search_key(:name), ' ')) AS word
                  WHERE (' ' || name_key) NOT LIKE ('% ' || word || '%'))
              AND NOT EXISTS (
                  SELECT FROM unnest(string_to_array(clearcare.search_key(:address), ' ')) AS word
                  WHERE (' ' || address_key) NOT LIKE ('% ' || word || '%'))
              AND (:county IS NULL OR county = :county)
              AND (:eircode IS NULL OR starts_with(eircode, :eircode))
              AND care_types @> CAST(:care_types AS text[])
              AND facilities @> CAST(:facilities AS text[])
              AND activities @> CAST(:activities AS text[])
      ),
      matching AS (
          SELECT * FROM matching_other_than_room_type
          WHERE cardinality(CAST(:room_types AS text[])) = 0
              OR room_types && CAST(:room_types AS text[])
      )
      """;

  private static final String COUNTS =
      """
      %s
      SELECT count(*) AS total, count(*) FILTER (WHERE fair_deal) AS fair_deal
      FROM matching
      """
          .formatted(MATCHING);

  // In whole metres in a straight line, from near to the centre's point: on geography, ST_Distance
  // measures on the WGS 84 spheroid (ADR-0026), and the cast to integer rounds it to the nearest
  // metre. It is null without near, since a point made of nulls is null, and for a centre with no
  // point in centre_point (db/V17).
  private static final String DISTANCE_M =
      "CAST(ST_Distance(centre_point.point,"
          + " CAST(ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326) AS geography))"
          + " AS integer)";

  // Only the page needs the points, so COUNTS and FACETS do not join them.
  private static final String PAGE =
      """
      %s
      SELECT centre_id, centre_name, address, county, eircode, maximum_occupancy, hiqa_url,
          amenities_report_id, amenities_inspection_date, care_types, room_types, activities,
          facilities, fair_deal, latest_report_id, latest_inspection_date,
          %s AS distance_m
      FROM matching
      LEFT JOIN clearcare.centre_point USING (centre_id)
      ORDER BY %s
      LIMIT :limit OFFSET :offset
      """;

  // Byte order ("C"), not the database's language rules, which skip spaces when comparing.
  private static final String BY_NAME = "name_key COLLATE \"C\", CAST(centre_id AS bigint)";

  private static final String PAGE_BY_NAME = PAGE.formatted(MATCHING, DISTANCE_M, BY_NAME);

  // A centre whose newest report has no date sorts with those that have no report.
  private static final String PAGE_BY_LATEST_INSPECTION =
      PAGE.formatted(MATCHING, DISTANCE_M, "latest_inspection_date DESC NULLS LAST, " + BY_NAME);

  // Nearest first, by the whole metres the result gives, so centres that show the same distance
  // are in name order. Centres without a point come last.
  private static final String PAGE_BY_DISTANCE =
      PAGE.formatted(MATCHING, DISTANCE_M, "distance_m NULLS LAST, " + BY_NAME);

  // Every matching centre that has a point in centre_point, with no limit: a map of one page of
  // them would show empty country where there are centres (ADR-0029). The inner join leaves out a
  // centre without a point. ST_X and ST_Y read geometry, so the stored point is cast; they give the
  // longitude and latitude as stored, unrounded.
  private static final String POINTS =
      """
      %s
      SELECT centre_id, centre_name, address, county,
          ST_Y(CAST(centre_point.point AS geometry)) AS latitude,
          ST_X(CAST(centre_point.point AS geometry)) AS longitude,
          %s AS distance_m
      FROM matching
      JOIN clearcare.centre_point USING (centre_id)
      ORDER BY %s
      """
          .formatted(MATCHING, DISTANCE_M, BY_NAME);

  // How many centres would match with each item added. An item added to care_type, facility or
  // activity keeps the matching centres that mention it. An item added to room_type widens it: the
  // centres that match everything else and mention that item or a room type already given. Items
  // that would match no centre have no row.
  private static final String FACETS =
      """
      %s
      SELECT 'care_type' AS facet, item, count(*) AS centres
      FROM matching, unnest(care_types) AS item
      GROUP BY item
      UNION ALL
      SELECT 'facility', item, count(*)
      FROM matching, unnest(facilities) AS item
      GROUP BY item
      UNION ALL
      SELECT 'activity', item, count(*)
      FROM matching, unnest(activities) AS item
      GROUP BY item
      UNION ALL
      SELECT 'room_type', item, count(*)
      FROM matching_other_than_room_type, unnest(CAST(:room_type_names AS text[])) AS item
      WHERE room_types && (CAST(:room_types AS text[]) || item)
      GROUP BY item
      """
          .formatted(MATCHING);

  private static final String CENTRE =
      """
      SELECT centre_id, centre_name, address, county, eircode, maximum_occupancy, hiqa_url,
          centre_phone, listing.place_id
      FROM clearcare.centre_search
      LEFT JOIN clearcare.centre_listing AS listing USING (centre_id)
      WHERE centre_id = :centre_id
      """;

  // One price per centre: the view keeps the latest, so this is a lookup (db/V24).
  private static final String CONTRACT_PRICE =
      "SELECT price, home_type, record_date FROM clearcare.centre_contract_price"
          + " WHERE centre_id = :centre_id";

  // One row per centre of the published snapshot (db/V24).
  private static final String REGISTRATION =
      """
      SELECT registration_date AS registered_from, registration_expiry_date AS registered_until,
          chief_inspector_note
      FROM clearcare.centre_registration
      WHERE centre_id = :centre_id
      """;

  // In the register's order, which is by number.
  private static final String EXTRA_CONDITIONS =
      """
      SELECT number, text
      FROM clearcare.centre_extra_condition
      WHERE centre_id = :centre_id
      ORDER BY number
      """;

  // The price in force, the kind of home it is for, and the date of the list it is from.
  private record ContractPrice(BigDecimal price, String homeType, LocalDate recordDate) {}

  // A centre's row in centre_registration. The dates are null when the snapshot was loaded
  // before db/V21.
  private record RegisteredCentre(
      LocalDate registeredFrom, LocalDate registeredUntil, String chiefInspectorNote) {}

  private record Counts(long total, long fairDeal) {}

  private record FacetCount(String facet, String item, long centres) {}

  private final JdbcClient jdbc;
  private final AmenityItemNames itemNames;

  CentreSearchRepository(JdbcClient jdbc, AmenityItemNames itemNames) {
    this.jdbc = jdbc;
    this.itemNames = itemNames;
  }

  /**
   * Returns one page of the centres that match and the facets of all of them, or nothing if no
   * register snapshot has been published. The snapshot, the counts, the page and the facets are
   * read in one transaction, so they agree even if the loader publishes a new snapshot meanwhile.
   */
  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  Optional<CentreSearchResult> search(CentreSearchParameters parameters) {
    Optional<RegisterSnapshot> snapshot = publishedSnapshot();
    if (snapshot.isEmpty()) {
      return Optional.empty();
    }
    SqlParameterSource sqlParameters = sqlParameters(parameters);
    Counts counts = jdbc.sql(COUNTS).paramSource(sqlParameters).query(Counts.class).single();
    String page =
        switch (parameters.sort()) {
          case "latest_inspection" -> PAGE_BY_LATEST_INSPECTION;
          case "distance" -> PAGE_BY_DISTANCE;
          default -> PAGE_BY_NAME;
        };
    List<CentreSummary> centres =
        jdbc.sql(page)
            .paramSource(sqlParameters)
            .query(CentreSearchRepository::centreSummary)
            .list();
    return Optional.of(
        new CentreSearchResult(
            centres,
            parameters.page(),
            parameters.pageSize(),
            counts.total(),
            snapshot.get(),
            facets(sqlParameters, counts.fairDeal()),
            parameters.sort()));
  }

  /**
   * Returns the point of every centre that matches and has one, in name order, or nothing if no
   * register snapshot has been published. The snapshot and the points are read in one transaction,
   * as in search.
   */
  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  Optional<CentrePointsResult> points(CentreSearchParameters parameters) {
    Optional<RegisterSnapshot> snapshot = publishedSnapshot();
    if (snapshot.isEmpty()) {
      return Optional.empty();
    }
    List<CentrePoint> points =
        jdbc.sql(POINTS).paramSource(sqlParameters(parameters)).query(CentrePoint.class).list();
    return Optional.of(new CentrePointsResult(points, snapshot.get()));
  }

  /**
   * Returns the centre with this centre_id, the register snapshot it was read from, its contract
   * price and its registration, or nothing if no snapshot has been published. The centre is null
   * if the snapshot does not have it, and the price, home type and date are null if no list has
   * been loaded for it. All of them are read in one transaction, as in search.
   */
  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  Optional<CentreResult> find(String centreId) {
    Optional<RegisterSnapshot> snapshot = publishedSnapshot();
    if (snapshot.isEmpty()) {
      return Optional.empty();
    }
    CentreDetail centre =
        jdbc.sql(CENTRE)
            .param("centre_id", centreId)
            .query(CentreDetail.class)
            .optional()
            .orElse(null);
    ContractPrice contractPrice =
        jdbc
            .sql(CONTRACT_PRICE)
            .param("centre_id", centreId)
            .query(ContractPrice.class)
            .optional()
            .orElse(new ContractPrice(null, null, null));
    RegisteredCentre registered =
        jdbc.sql(REGISTRATION)
            .param("centre_id", centreId)
            .query(RegisteredCentre.class)
            .optional()
            .orElse(new RegisteredCentre(null, null, null));
    List<ExtraCondition> extraConditions =
        jdbc.sql(EXTRA_CONDITIONS).param("centre_id", centreId).query(ExtraCondition.class).list();
    return Optional.of(
        new CentreResult(
            centre,
            snapshot.get(),
            contractPrice.price(),
            contractPrice.homeType(),
            contractPrice.recordDate(),
            registered.registeredFrom() == null
                ? null
                : new Registration(registered.registeredFrom(), registered.registeredUntil()),
            extraConditions,
            registered.chiefInspectorNote()));
  }

  private Optional<RegisterSnapshot> publishedSnapshot() {
    return jdbc.sql(REGISTER_SNAPSHOT).query(CentreSearchRepository::registerSnapshot).optional();
  }

  // Every item of the contract is a key, in its order, and stays 0 unless FACETS counts it. A name
  // the contract does not list cannot be asked for, so it gets no key.
  private Facets facets(SqlParameterSource sqlParameters, long fairDeal) {
    Map<String, Map<String, Long>> facets =
        Map.of(
            "care_type", zeros(itemNames.careTypes()),
            "room_type", zeros(itemNames.roomTypes()),
            "facility", zeros(itemNames.facilities()),
            "activity", zeros(itemNames.activities()));
    for (FacetCount count :
        jdbc.sql(FACETS).paramSource(sqlParameters).query(FacetCount.class).list()) {
      facets.get(count.facet()).replace(count.item(), count.centres());
    }
    return new Facets(
        facets.get("care_type"),
        facets.get("room_type"),
        facets.get("facility"),
        facets.get("activity"),
        fairDeal);
  }

  private static Map<String, Long> zeros(List<String> names) {
    Map<String, Long> counts = new LinkedHashMap<>();
    for (String name : names) {
      counts.put(name, 0L);
    }
    return counts;
  }

  // The text and coordinate parameters are typed so that PostgreSQL knows their type when they are
  // null. The item names go as arrays, which the queries cast to text[].
  private SqlParameterSource sqlParameters(CentreSearchParameters parameters) {
    CentreSearchParameters.Coordinates near = parameters.near();
    return new MapSqlParameterSource()
        .addValue("name", parameters.name(), Types.VARCHAR)
        .addValue("address", parameters.address(), Types.VARCHAR)
        .addValue("county", parameters.county(), Types.VARCHAR)
        .addValue("eircode", parameters.eircode(), Types.VARCHAR)
        .addValue("care_types", parameters.careTypes().toArray(String[]::new))
        .addValue("room_types", parameters.roomTypes().toArray(String[]::new))
        .addValue("facilities", parameters.facilities().toArray(String[]::new))
        .addValue("activities", parameters.activities().toArray(String[]::new))
        .addValue("room_type_names", itemNames.roomTypes().toArray(String[]::new))
        .addValue("latitude", near == null ? null : near.latitude(), Types.DOUBLE)
        .addValue("longitude", near == null ? null : near.longitude(), Types.DOUBLE)
        .addValue("limit", parameters.pageSize())
        .addValue("offset", (long) (parameters.page() - 1) * parameters.pageSize());
  }

  private static CentreSummary centreSummary(ResultSet row, int rowNumber) throws SQLException {
    return new CentreSummary(
        row.getString("centre_id"),
        row.getString("centre_name"),
        row.getString("address"),
        row.getString("county"),
        row.getString("eircode"),
        row.getObject("maximum_occupancy", Integer.class),
        row.getString("hiqa_url"),
        mentionedAmenities(row),
        row.getBoolean("fair_deal"),
        latestInspection(row),
        row.getObject("distance_m", Integer.class));
  }

  private static MentionedAmenities mentionedAmenities(ResultSet row) throws SQLException {
    Long reportId = row.getObject("amenities_report_id", Long.class);
    if (reportId == null) {
      return null;
    }
    return new MentionedAmenities(
        reportId,
        row.getObject("amenities_inspection_date", LocalDate.class),
        texts(row, "care_types"),
        texts(row, "room_types"),
        texts(row, "activities"),
        texts(row, "facilities"));
  }

  private static LatestInspection latestInspection(ResultSet row) throws SQLException {
    if (row.getObject("latest_report_id") == null) {
      return null;
    }
    return new LatestInspection(row.getObject("latest_inspection_date", LocalDate.class));
  }

  // A text[] column. ARRAY(subquery) gives an empty array, not null, when there are no items.
  private static List<String> texts(ResultSet row, String column) throws SQLException {
    Array array = row.getArray(column);
    try {
      return List.of((String[]) array.getArray());
    } finally {
      array.free();
    }
  }

  // The API gives fetched_at to the second.
  private static RegisterSnapshot registerSnapshot(ResultSet row, int rowNumber)
      throws SQLException {
    OffsetDateTime fetchedAt = row.getObject("fetched_at", OffsetDateTime.class);
    return new RegisterSnapshot(
        fetchedAt.toInstant().truncatedTo(ChronoUnit.SECONDS),
        row.getString("url"),
        row.getString("sha256"));
  }
}
