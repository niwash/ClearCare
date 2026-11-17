package ie.clearcare.api.alerts;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import ie.clearcare.api.security.SiteToken;

/**
 * The alert subscriptions of a signed-in visitor (ADR-0034), as api/openapi.yaml describes them.
 *
 * <p>Nothing about a subscription comes from a body: a facility, a county and everything are three
 * paths, so the metadata the API stores is built here, and the centre or county it names is checked
 * before the row is written. The account is named by the site's server, with the shared token
 * {@link SiteToken} checks.
 */
@RestController
class AlertController {

  private static final String ACCOUNT = "X-ClearCare-Sub";
  private static final String TOKEN = "X-ClearCare-Token";

  private final AlertRepository repository;
  private final SiteToken token;
  private final UnsubscribeToken links;

  AlertController(AlertRepository repository, SiteToken token, UnsubscribeToken links) {
    this.repository = repository;
    this.token = token;
    this.links = links;
  }

  @GetMapping("/alerts")
  AlertSubscriptions get(
      @RequestHeader(name = ACCOUNT, required = false) String cognitoSub,
      @RequestHeader(name = TOKEN, required = false) String caller) {
    token.require(cognitoSub, caller);
    return new AlertSubscriptions(repository.list(cognitoSub));
  }

  @PutMapping("/alerts/facility/{centreId}")
  AlertSubscription facility(
      @RequestHeader(name = ACCOUNT, required = false) String cognitoSub,
      @RequestHeader(name = TOKEN, required = false) String caller,
      @PathVariable String centreId) {
    token.require(cognitoSub, caller);
    if (!repository.centreExists(centreId)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "There is no centre with that id.");
    }
    return repository.subscribe(cognitoSub, "FACILITY", AlertMetadata.facility(centreId));
  }

  @PutMapping("/alerts/county/{county}")
  AlertSubscription county(
      @RequestHeader(name = ACCOUNT, required = false) String cognitoSub,
      @RequestHeader(name = TOKEN, required = false) String caller,
      @PathVariable String county) {
    token.require(cognitoSub, caller);
    int countyId =
        repository
            .countyId(county)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "There is no county by that name."));
    return repository.subscribe(cognitoSub, "COUNTY", AlertMetadata.county(countyId));
  }

  @PutMapping("/alerts/all")
  AlertSubscription everything(
      @RequestHeader(name = ACCOUNT, required = false) String cognitoSub,
      @RequestHeader(name = TOKEN, required = false) String caller) {
    token.require(cognitoSub, caller);
    return repository.subscribe(cognitoSub, "ALL", AlertMetadata.everything());
  }

  // 204: stopping is not a subscription.
  @DeleteMapping("/alerts/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void stop(
      @RequestHeader(name = ACCOUNT, required = false) String cognitoSub,
      @RequestHeader(name = TOKEN, required = false) String caller,
      @PathVariable long id) {
    token.require(cognitoSub, caller);
    if (!repository.stop(cognitoSub, id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This account has no such alert.");
    }
  }

  @DeleteMapping("/alerts")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void stopAll(
      @RequestHeader(name = ACCOUNT, required = false) String cognitoSub,
      @RequestHeader(name = TOKEN, required = false) String caller) {
    token.require(cognitoSub, caller);
    repository.stopAll(cognitoSub);
  }

  /**
   * The one route an email can call: no session, no account header, only the link the pipeline
   * signed. A link that arrives twice is answered the same way, so a mail client that follows it
   * again changes nothing.
   */
  @PostMapping("/alerts/unsubscribe")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void unsubscribe(
      @RequestHeader(name = TOKEN, required = false) String caller,
      @RequestBody Unsubscribe request) {
    token.requireCaller(caller);
    repository.stopAll(links.subject(request == null ? null : request.token()));
  }
}

/** What the site shows: the subscriptions of the account, oldest first. */
record AlertSubscriptions(List<AlertSubscription> subscriptions) {}

/** The link from an email, as the site posts it back. */
record Unsubscribe(String token) {}
