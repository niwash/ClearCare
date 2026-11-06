package ie.clearcare.api.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** The check that a request is the site's own, whoever it is about. */
class SiteTokenTest {

  private static final String SUB = "1f2e3d4c-0000-4000-8000-000000000000";

  @Test
  void refusesEveryRequestWhileNoTokenIsConfigured() {
    SiteToken token = new SiteToken("");

    assertThatThrownBy(() -> token.require(SUB, "anything"))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            refused -> assertThat(refused.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
  }

  @Test
  void acceptsTheSitesOwnRequest() {
    assertThatCode(() -> new SiteToken("shared-token").require(SUB, "shared-token"))
        .doesNotThrowAnyException();
  }

  @Test
  void refusesTheWrongToken() {
    SiteToken token = new SiteToken("shared-token");

    assertThatThrownBy(() -> token.require(SUB, "shared-tokeN"))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            refused -> assertThat(refused.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
    assertThatThrownBy(() -> token.require(SUB, null))
        .isInstanceOf(ResponseStatusException.class);
  }

  // The subject is what a row is keyed on, so a value that could not be one is refused rather than
  // stored.
  @Test
  void refusesASubjectThatIsNotAnAccountId() {
    SiteToken token = new SiteToken("shared-token");

    assertThatThrownBy(() -> token.require("", "shared-token"))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            refused -> assertThat(refused.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
    assertThatThrownBy(() -> token.require("sub' OR true --", "shared-token"))
        .isInstanceOf(ResponseStatusException.class);
  }
}
