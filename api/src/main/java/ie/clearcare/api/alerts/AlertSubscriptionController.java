package ie.clearcare.api.alerts;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import ie.clearcare.api.security.SiteToken;

/**
 * The alerts routes in api/openapi.yaml (CCARE-270): the account's subscriptions, a target added or
 * cancelled one at a time or every one of them at once, and the signed-out unsubscribe link.
 *
 * <p>The account's routes follow the saved search's pattern (ADR-0025): the site's server sends the
 * account's Cognito subject and the token {@link SiteToken} checks, never a session or a number the
 * browser chose. The packages route names no account and takes the token alone.
 *
 * <p>{@code POST /alerts/unsubscribe} is the one route that speaks for an account without a session
 * or the site's token. The email link carries a random per-account capability, and holding it is
 * the proof (ADR-0034). It is a POST because it deletes rows: the site's page asks the visitor
 * first, and a mail scanner that only opens the link changes nothing.
 */
@RestController
class AlertSubscriptionController {

  private static final String ACCOUNT = "X-ClearCare-Sub";
  private static final String TOKEN = "X-ClearCare-Token";

  private final AlertSubscriptionRepository repository;
  private final SiteToken token;

  AlertSubscriptionController(AlertSubscriptionRepository repository, SiteToken token) {
    this.repository = repository;
    this.token = token;
  }

  @GetMapping("/alerts/subscriptions")
  AlertSubscriptions list(
      @RequestHeader(name = ACCOUNT, required = false) String cognitoSub,
      @RequestHeader(name = TOKEN, required = false) String caller) {
    token.require(cognitoSub, caller);
    return new AlertSubscriptions(repository.list(cognitoSub));
  }

  // The packages the site may offer, and the ids it must send to follow one (CCARE-271). About no
  // account, so the site's token alone is the check. The site reads the id here rather than
  // assuming the seed's order: ids come from an identity column, and a database whose sequence has
  // moved on numbers them differently.
  @GetMapping("/alerts/packages")
  AlertPackages packages(@RequestHeader(name = TOKEN, required = false) String caller) {
    token.requireSite(caller);
    return new AlertPackages(repository.packages());
  }

  // 200 rather than 201: adding the same target again returns the row that already exists, so the
  // answer is the stored subscription either way, and a double click is not an error.
  @PostMapping("/alerts/subscriptions")
  AlertSubscription add(
      @RequestHeader(name = ACCOUNT, required = false) String cognitoSub,
      @RequestHeader(name = TOKEN, required = false) String caller,
      @RequestBody AlertSubscriptionRequest request) {
    token.require(cognitoSub, caller);
    return repository.subscribe(cognitoSub, request);
  }

  // Stopping the every-report alert stops everything (CCARE-271): the broadest target an account can
  // follow leaves nothing worth sending, so the site cancels the account's rows with this. 204
  // whatever was there, like the single cancel, so a second press is not an error.
  @DeleteMapping("/alerts/subscriptions")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void cancelAll(
      @RequestHeader(name = ACCOUNT, required = false) String cognitoSub,
      @RequestHeader(name = TOKEN, required = false) String caller) {
    token.require(cognitoSub, caller);
    repository.cancelAll(cognitoSub);
  }

  // 204 whatever happened: an id that is already gone, or another account's id, is the same
  // outcome as a cancelled row, so the site's button can be pressed twice.
  @DeleteMapping("/alerts/subscriptions/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void cancel(
      @PathVariable long id,
      @RequestHeader(name = ACCOUNT, required = false) String cognitoSub,
      @RequestHeader(name = TOKEN, required = false) String caller) {
    token.require(cognitoSub, caller);
    repository.cancel(cognitoSub, id);
  }

  // The token is the whole authentication: there is no header to check, and ADR-0034 keeps the
  // capability out of personal data, so a leaked link reveals no address or subject. A POST,
  // because it deletes: opening the link in a mail scanner must not unsubscribe anyone.
  @PostMapping("/alerts/unsubscribe")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void unsubscribe(@RequestParam(name = "token", required = false) String token) {
    repository.unsubscribe(token);
  }
}
