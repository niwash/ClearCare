package ie.clearcare.api.centres;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Reads centres from the views the clearcare_api role can read (db/V1, db/V7, db/V10). */
@Repository
class CentreSearchRepository {

  private static final String REGISTER_SNAPSHOT =
      "SELECT fetched_at, url, sha256 FROM clearcare.published_register_snapshot";

  // Every parameter that is not null must match. For name and address, each word of the folded
  // input must be the start of a word of the folded column. search_key leaves only a-z, 0-9 and
  // single spaces, so a word cannot act as a LIKE wildcard, and input with no words left is
  // ignored. A full Eircode has all seven characters, so as a prefix it matches only itself.
  private static final String MATCHES =
      """
      NOT EXISTS (
          SELECT FROM unnest(string_to_array(clearcare.search_key(:name), ' ')) AS word
          WHERE (' ' || name_key) NOT LIKE ('% ' || word || '%'))
      AND NOT EXISTS (
          SELECT FROM unnest(string_to_array(clearcare.search_key(:address), ' ')) AS word
          WHERE (' ' || address_key) NOT LIKE ('% ' || word || '%'))
      AND (:county IS NULL OR county = :county)
      AND (:eircode IS NULL OR starts_with(eircode, :eircode))
      """;

  private static final String COUNT =
      "SELECT count(*) FROM clearcare.centre_search WHERE %s".formatted(MATCHES);

  // Byte order ("C"), not the database's language rules, which skip spaces when comparing.
  private static final String PAGE =
      """
      SELECT centre_id, centre_name, address, county, eircode, maximum_occupancy, hiqa_url
      FROM clearcare.centre_search
      WHERE %s
      ORDER BY name_key COLLATE "C", CAST(centre_id AS bigint)
      LIMIT :limit OFFSET :offset
      """
          .formatted(MATCHES);

  private static final String CENTRE =
      """
      SELECT centre_id, centre_name, address, county, eircode, maximum_occupancy, hiqa_url,
          centre_phone
      FROM clearcare.centre_search
      WHERE centre_id = :centre_id
      """;

  // One price per centre: the view keeps the latest, so this is a lookup (db/V10).
  private static final String CONTRACT_PRICE =
      "SELECT price, home_type FROM clearcare.centre_contract_price"
          + " WHERE centre_id = :centre_id";

  // The price in force, and the kind of home it is for.
  private record ContractPrice(BigDecimal price, String homeType) {}

  private final JdbcClient jdbc;

  CentreSearchRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  /**
   * Returns one page of the centres that match, or nothing if no register snapshot has been
   * published. The snapshot, the total and the page are read in one transaction, so they agree even
   * if the loader publishes a new snapshot meanwhile.
   */
  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  Optional<CentreSearchResult> search(CentreSearchParameters parameters) {
    Optional<RegisterSnapshot> snapshot = publishedSnapshot();
    if (snapshot.isEmpty()) {
      return Optional.empty();
    }
    SqlParameterSource sqlParameters = sqlParameters(parameters);
    long total = jdbc.sql(COUNT).paramSource(sqlParameters).query(Long.class).single();
    List<Centre> centres = jdbc.sql(PAGE).paramSource(sqlParameters).query(Centre.class).list();
    return Optional.of(
        new CentreSearchResult(
            centres, parameters.page(), parameters.pageSize(), total, snapshot.get()));
  }

  /**
   * Returns the centre with this centre_id, the register snapshot it was read from and its contract
   * price and home type, or nothing if no snapshot has been published. The centre is null if the
   * snapshot does not have it, and the price and home type are null if no list has been loaded for
   * it. All of them are read in one transaction, as in search.
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
            .orElse(new ContractPrice(null, null));
    return Optional.of(
        new CentreResult(centre, snapshot.get(), contractPrice.price(), contractPrice.homeType()));
  }

  private Optional<RegisterSnapshot> publishedSnapshot() {
    return jdbc.sql(REGISTER_SNAPSHOT).query(CentreSearchRepository::registerSnapshot).optional();
  }

  // The text parameters are typed so that PostgreSQL knows their type when they are null.
  private static SqlParameterSource sqlParameters(CentreSearchParameters parameters) {
    return new MapSqlParameterSource()
        .addValue("name", parameters.name(), Types.VARCHAR)
        .addValue("address", parameters.address(), Types.VARCHAR)
        .addValue("county", parameters.county(), Types.VARCHAR)
        .addValue("eircode", parameters.eircode(), Types.VARCHAR)
        .addValue("limit", parameters.pageSize())
        .addValue("offset", (long) (parameters.page() - 1) * parameters.pageSize());
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
