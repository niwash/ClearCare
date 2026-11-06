package ie.clearcare.api.preferences;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.json.JsonMapper;

/**
 * The two tables the API writes (db/V15, ADR-0025): an account row and the saved search that belongs
 * to it, one saved search per account.
 *
 * <p>The document is stored as jsonb and read back whole, so the API needs to know nothing about the
 * filters the site offers. The account is named by its Cognito subject, which is resolved to the
 * number these tables key on; the browser never supplies that number.
 */
@Repository
class UserPreferenceRepository {

  private static final String FIND =
      """
      SELECT p.preferences, p.updated_at
      FROM clearcare.user_preferences p
      JOIN clearcare.users u ON u.id = p.user_id
      WHERE u.cognito_sub = :sub
      """;

  // The account row is created the first time this account saves anything, and left alone after
  // that. DO UPDATE rather than DO NOTHING because RETURNING gives no row for a conflict that was
  // ignored, and the id is what the saved search is written against.
  private static final String ACCOUNT =
      """
      INSERT INTO clearcare.users (cognito_sub) VALUES (:sub)
      ON CONFLICT (cognito_sub) DO UPDATE SET cognito_sub = EXCLUDED.cognito_sub
      RETURNING id
      """;

  // Saving replaces the row: the search page holds one saved search per account, and saving again
  // is a change of that choice rather than a second one.
  private static final String SAVE =
      """
      INSERT INTO clearcare.user_preferences (user_id, preferences, updated_at)
      VALUES (:id, CAST(:preferences AS jsonb), now())
      ON CONFLICT (user_id) DO UPDATE
      SET preferences = EXCLUDED.preferences, updated_at = EXCLUDED.updated_at
      RETURNING preferences, updated_at
      """;

  private static final String FORGET =
      """
      DELETE FROM clearcare.user_preferences
      WHERE user_id = (SELECT id FROM clearcare.users WHERE cognito_sub = :sub)
      """;

  private final JdbcClient jdbc;
  private final JsonMapper json;

  UserPreferenceRepository(JdbcClient jdbc, JsonMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  /** The account's saved search, or nothing if it has not saved one. */
  Optional<SavedSearchResult> find(String cognitoSub) {
    return jdbc.sql(FIND).param("sub", cognitoSub).query(this::savedSearch).optional();
  }

  /**
   * Replaces the account's saved search and returns what was stored.
   *
   * <p>Both writes commit together: an account row without the saved search it was made for is a
   * row the site has nothing to show.
   */
  @Transactional
  SavedSearchResult save(String cognitoSub, SavedSearch document) {
    long userId = jdbc.sql(ACCOUNT).param("sub", cognitoSub).query(Long.class).single();
    return jdbc
        .sql(SAVE)
        .param("id", userId)
        .param("preferences", json.writeValueAsString(document))
        .query(this::savedSearch)
        .single();
  }

  /** Forgets the account's saved search, if it has one. The account row stays. */
  void forget(String cognitoSub) {
    jdbc.sql(FORGET).param("sub", cognitoSub).update();
  }

  private SavedSearchResult savedSearch(ResultSet row, int rowNumber) throws SQLException {
    return new SavedSearchResult(
        json.readValue(row.getString("preferences"), SavedSearch.class),
        row.getObject("updated_at", OffsetDateTime.class));
  }
}
