package ie.clearcare.api.centres;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Register checks shared by centre reports and amenities within their read transactions. */
@Repository
public class CentreRegisterChecks {

  private final JdbcClient jdbc;

  public CentreRegisterChecks(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public boolean registerPublished() {
    return jdbc
        .sql("SELECT 1 FROM clearcare.published_register_snapshot")
        .query(Integer.class)
        .optional()
        .isPresent();
  }

  // centre_search contains only the centres in the published register snapshot.
  public boolean centreExists(String centreId) {
    return jdbc
        .sql("SELECT 1 FROM clearcare.centre_search WHERE centre_id = :centre_id")
        .param("centre_id", centreId)
        .query(Integer.class)
        .optional()
        .isPresent();
  }
}
