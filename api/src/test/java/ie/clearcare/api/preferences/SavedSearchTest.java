package ie.clearcare.api.preferences;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

/** The document a saved search may carry, refused before it reaches the table. */
class SavedSearchTest {

  // A document from anywhere else is refused before it reaches the table.
  @Test
  void refusesADocumentTheSearchPageCouldNotHaveSent() {
    SavedSearch good = new SavedSearch("Cork", List.of("dementia"), null, null, null, "name");
    assertThat(good.checked().careTypes()).containsExactly("dementia");

    assertThatThrownBy(() -> new SavedSearch("Cork", null, null, null, null, "newest").checked())
        .isInstanceOf(ResponseStatusException.class);
    assertThatThrownBy(
            () -> new SavedSearch("Cork", List.of("Dementia"), null, null, null, null).checked())
        .isInstanceOf(ResponseStatusException.class);
    assertThatThrownBy(() -> new SavedSearch("Cork", List.of(""), null, null, null, null).checked())
        .isInstanceOf(ResponseStatusException.class);
  }

  // A body that leaves the lists and the order out is a search with no filters in name order.
  @Test
  void treatsAMissingValueAsTheDefault() {
    SavedSearch document = new SavedSearch(null, null, null, null, null, null).checked();

    assertThat(document.county()).isNull();
    assertThat(document.sortBy()).isEqualTo("name");
    assertThat(document.careTypes()).isEmpty();
  }

  // The page has 93 options across its four lists, so a body with more is not one of its documents,
  // and catching it here keeps it inside the table's size limit rather than failing on the insert.
  @Test
  void refusesMoreOptionsThanAPageCanHold() {
    List<String> thirty = IntStream.range(0, 30).mapToObj(option -> "option-" + option).toList();

    assertThat(thirty).hasSize(30);
    assertThatThrownBy(() -> new SavedSearch("Cork", thirty, thirty, thirty, thirty, "name").checked())
        .isInstanceOf(ResponseStatusException.class);
    assertThat(new SavedSearch("Cork", thirty, thirty, thirty, List.of("garden"), "name").checked())
        .isNotNull();
  }

  @Test
  void refusesASlugLongerThanAnyTheSiteHas() {
    String longSlug = "a".repeat(33);

    assertThatThrownBy(() -> new SavedSearch(null, List.of(longSlug), null, null, null, null).checked())
        .isInstanceOf(ResponseStatusException.class);
  }
}
