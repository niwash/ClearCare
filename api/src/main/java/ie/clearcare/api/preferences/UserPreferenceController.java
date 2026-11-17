package ie.clearcare.api.preferences;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import ie.clearcare.api.security.SiteToken;

/**
 * GET, PUT and DELETE /preferences, as described in api/openapi.yaml: the search a signed-in visitor
 * asked the site to remember (ADR-0025).
 *
 * <p>The account is named by a header, because the browser holds no token the API could read
 * (ADR-0020): the site's server takes the subject from its own session and sends it with the shared
 * token {@link SiteToken} checks.
 */
@RestController
class UserPreferenceController {

  private static final String ACCOUNT = "X-ClearCare-Sub";
  private static final String TOKEN = "X-ClearCare-Token";

  private final UserPreferenceRepository repository;
  private final SiteToken token;

  UserPreferenceController(UserPreferenceRepository repository, SiteToken token) {
    this.repository = repository;
    this.token = token;
  }

  @GetMapping("/preferences")
  SavedSearchResult get(
      @RequestHeader(name = ACCOUNT, required = false) String cognitoSub,
      @RequestHeader(name = TOKEN, required = false) String caller) {
    token.require(cognitoSub, caller);
    return repository.find(cognitoSub).orElse(SavedSearchResult.NONE);
  }

  @PutMapping("/preferences")
  SavedSearchResult save(
      @RequestHeader(name = ACCOUNT, required = false) String cognitoSub,
      @RequestHeader(name = TOKEN, required = false) String caller,
      @RequestBody SavedSearch document) {
    token.require(cognitoSub, caller);
    return repository.save(cognitoSub, document.checked());
  }

  // 204 rather than the empty document: forgetting is not a saved search.
  @DeleteMapping("/preferences")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void forget(
      @RequestHeader(name = ACCOUNT, required = false) String cognitoSub,
      @RequestHeader(name = TOKEN, required = false) String caller) {
    token.require(cognitoSub, caller);
    repository.forget(cognitoSub);
  }
}
