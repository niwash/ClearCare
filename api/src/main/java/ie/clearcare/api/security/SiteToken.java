package ie.clearcare.api.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Decides whether a request came from the site's own server, and which account it is about, if any.
 *
 * <p>The browser never holds a Cognito token (ADR-0020), so the API cannot check a session: the
 * Next server reads its encrypted cookie, takes the account's subject claim and sends it with a
 * token both services share. Without that check anyone could read or replace any account's rows by
 * naming a subject, which is why these routes answer 503 while no token is configured and 401 for a
 * request that does not carry it.
 *
 * <p>The token says nothing about <em>what</em> the caller wants, so it is not one credential per
 * feature: a saved search (ADR-0025), a shortlist of centres, or anything else the site's server
 * asks for on a visitor's behalf is proved by this same value, sent as {@code X-ClearCare-Token}.
 * Rotating it therefore rotates every feature that calls the API, which is the cost of one secret
 * rather than one per feature.
 *
 * <p>It also guards a route that is about no account: the points of the search page's map are
 * Google's coordinates, which only the site may be given (ADR-0029).
 */
@Component
public class SiteToken {

  // The subject claim of a Cognito pool: a UUID today, and nothing but these characters.
  private static final Pattern SUB = Pattern.compile("[A-Za-z0-9_-]{1,128}");

  private final String expected;

  public SiteToken(@Value("${clearcare.site.token:}") String expected) {
    this.expected = expected.trim();
  }

  /**
   * Answers every request that is not the site's: 503 while this deployment has no token, and 401
   * for a request with the wrong token. For a route that is about no account.
   */
  public void requireSite(String token) {
    if (expected.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "This API is not configured for the site's requests.");
    }
    if (token == null || !MessageDigest.isEqual(bytes(expected), bytes(token))) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The request is not from the site.");
    }
  }

  /** As requireSite, and 401 for a request from the site that names no account. */
  public void require(String cognitoSub, String token) {
    requireSite(token);
    if (cognitoSub == null || !SUB.matcher(cognitoSub).matches()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The request names no account.");
    }
  }

  // Compared in constant time: a token that is guessed a character at a time would otherwise take
  // longer to refuse the closer it got.
  private static byte[] bytes(String value) {
    return value.getBytes(StandardCharsets.UTF_8);
  }
}
