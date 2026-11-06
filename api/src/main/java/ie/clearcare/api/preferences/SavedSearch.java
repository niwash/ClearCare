package ie.clearcare.api.preferences;

import java.util.List;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * The search a visitor asked the site to remember, as the search page holds it
 * (api/openapi.yaml): a county, an order and the ticked options, one list per group. The names are
 * the document's, not this API's query parameters: {@code care_types} holds the site's slugs
 * ({@code dementia}), where {@code GET /centres} takes amenity item names ({@code Dementia care}).
 *
 * <p>The API stores this document without reading its meaning, so a filter added to the site needs
 * no migration and no release here.
 */
public record SavedSearch(
    String county,
    List<String> careTypes,
    List<String> roomTypes,
    List<String> facilities,
    List<String> activities,
    String sortBy) {

  // The site's slugs: "dementia", "en-suite", "shared-bathroom". Nothing else can be in a list.
  private static final Pattern SLUG = Pattern.compile("[a-z0-9]+(-[a-z0-9]+)*");
  // The site offers two orders (lib/search-filters.ts); the default is "name".
  private static final List<String> SORTS = List.of("name", "latest_inspection");
  // The longest slug the site has is "intellectual-disability"; this leaves room for a longer one
  // without leaving room to fill the column.
  private static final int MAX_SLUG_LENGTH = 32;
  // A page has 93 options across its four groups. Capped here as well as per list, so a document
  // stays inside the table's size limit and a body that is not a page's is refused rather than
  // failing on the way into it.
  private static final int MAX_OPTIONS = 100;
  // "Tipperary" is the longest county name on the register.
  private static final int MAX_COUNTY_LENGTH = 32;

  // A body that leaves a list out means it is empty, so a caller need not send all four.
  public SavedSearch {
    county = county == null || county.isBlank() ? null : county;
    careTypes = careTypes == null ? List.of() : List.copyOf(careTypes);
    roomTypes = roomTypes == null ? List.of() : List.copyOf(roomTypes);
    facilities = facilities == null ? List.of() : List.copyOf(facilities);
    activities = activities == null ? List.of() : List.copyOf(activities);
    sortBy = sortBy == null || sortBy.isBlank() ? "name" : sortBy;
  }

  /**
   * Returns this document if it could have come from the site's search page, and refuses it with
   * 400 otherwise. A value that is not a slug, an order the site does not offer, or more options
   * than a page can hold is a client mistake, not a document to store.
   */
  SavedSearch checked() {
    if (county != null && county.length() > MAX_COUNTY_LENGTH) {
      throw refused("county must be at most %d characters".formatted(MAX_COUNTY_LENGTH));
    }
    if (!SORTS.contains(sortBy)) {
      throw refused("sort_by must be name or latest_inspection");
    }
    int given = 0;
    for (List<String> options : List.of(careTypes, roomTypes, facilities, activities)) {
      if (options.size() > MAX_OPTIONS) {
        throw refused("each list must hold at most %d options".formatted(MAX_OPTIONS));
      }
      given += options.size();
      for (String option : options) {
        if (option == null
            || option.length() > MAX_SLUG_LENGTH
            || !SLUG.matcher(option).matches()) {
          throw refused(
              "each option must be a slug of lower-case letters, digits and hyphens, such as"
                  + " en-suite");
        }
      }
    }
    if (given > MAX_OPTIONS) {
      throw refused("the four lists must hold at most %d options between them".formatted(MAX_OPTIONS));
    }
    return this;
  }

  private static ResponseStatusException refused(String detail) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, detail);
  }
}
