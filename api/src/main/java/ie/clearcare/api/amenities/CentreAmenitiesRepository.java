package ie.clearcare.api.amenities;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Reads amenities from the view the clearcare_api role can read (db/V11). */
@Repository
class CentreAmenitiesRepository {

  // The register's views (db/V1). Amenities are served only for a centre the register snapshot
  // has, and only once a snapshot has been published, as reports are.
  private static final String REGISTER_SNAPSHOT =
      "SELECT 1 FROM clearcare.published_register_snapshot";

  private static final String CENTRE =
      "SELECT 1 FROM clearcare.centre_search WHERE centre_id = :centre_id";

  // The view holds the newest extraction of the centre's newest report that has one.
  private static final String AMENITIES =
      """
      SELECT report_id, inspection_date, care_types, room_types, has_outdoor_space, activities,
             has_transport, has_chapel_or_religious_services, special_units, dining_notes,
             other_notes, extractor_version, model
      FROM clearcare.centre_amenities
      WHERE centre_id = :centre_id
      """;

  private final JdbcClient jdbc;

  CentreAmenitiesRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  /**
   * Looks up the centre's amenities, or returns nothing if no register snapshot has been published.
   * The centre and its amenities are read in one transaction, so they agree even if a register is
   * loaded meanwhile.
   */
  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  Optional<CentreAmenitiesLookup> find(String centreId) {
    if (!registerPublished()) {
      return Optional.empty();
    }
    if (!centreExists(centreId)) {
      return Optional.of(new CentreAmenitiesLookup(false, null));
    }
    CentreAmenities amenities =
        jdbc.sql(AMENITIES)
            .param("centre_id", centreId)
            .query(CentreAmenitiesRepository::row)
            .optional()
            .orElse(null);
    return Optional.of(new CentreAmenitiesLookup(true, amenities));
  }

  private boolean registerPublished() {
    return jdbc.sql(REGISTER_SNAPSHOT).query(Integer.class).optional().isPresent();
  }

  private boolean centreExists(String centreId) {
    return jdbc.sql(CENTRE).param("centre_id", centreId).query(Integer.class).optional().isPresent();
  }

  private static CentreAmenities row(ResultSet rs, int rowNumber) throws SQLException {
    return new CentreAmenities(
        rs.getLong("report_id"),
        rs.getObject("inspection_date", LocalDate.class),
        texts(rs, "care_types"),
        texts(rs, "room_types"),
        rs.getObject("has_outdoor_space", Boolean.class),
        texts(rs, "activities"),
        rs.getObject("has_transport", Boolean.class),
        rs.getObject("has_chapel_or_religious_services", Boolean.class),
        texts(rs, "special_units"),
        rs.getString("dining_notes"),
        rs.getString("other_notes"),
        rs.getString("extractor_version"),
        rs.getString("model"));
  }

  // A text[] column. The columns are NOT NULL, so there is always an array.
  private static List<String> texts(ResultSet rs, String column) throws SQLException {
    Array array = rs.getArray(column);
    try {
      return List.of((String[]) array.getArray());
    } finally {
      array.free();
    }
  }
}
