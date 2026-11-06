package ie.clearcare.api.preferences;

import java.time.OffsetDateTime;

/**
 * What GET /preferences answers: the account's saved search, and when it was saved. The saved
 * search is null when the visitor has not saved one, and then the time is null too.
 */
public record SavedSearchResult(SavedSearch preferences, OffsetDateTime updatedAt) {

  /** The answer for an account that has saved nothing. */
  static final SavedSearchResult NONE = new SavedSearchResult(null, null);
}
