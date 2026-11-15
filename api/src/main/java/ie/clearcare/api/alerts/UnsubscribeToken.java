package ie.clearcare.api.alerts;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * The link in an alert email, which has to work without a session (ADR-0034): the account's subject,
 * a dot, and an HMAC of that subject under a secret the API and the pipeline share.
 *
 * <p>The subject is not a secret, so it travels in the open; the signature is what says the site
 * wrote the link, and it is compared in constant time.
 */
@Component
class UnsubscribeToken {

  private static final String ALGORITHM = "HmacSHA256";

  private final byte[] secret;

  UnsubscribeToken(@Value("${clearcare.alerts.link-secret:}") String secret) {
    this.secret = secret.trim().getBytes(StandardCharsets.UTF_8);
  }

  /** The subject the link names, once its signature is this deployment's. */
  String subject(String token) {
    if (secret.length == 0) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "Alert links are not configured on this API.");
    }
    int dot = token == null ? -1 : token.lastIndexOf('.');
    if (dot <= 0 || dot == token.length() - 1) {
      throw new ResponseStatusException(
          HttpStatus.UNAUTHORIZED, "The link is not one this site sent.");
    }
    String subject = token.substring(0, dot);
    byte[] given = token.substring(dot + 1).toLowerCase().getBytes(StandardCharsets.US_ASCII);
    if (!MessageDigest.isEqual(sign(subject).getBytes(StandardCharsets.US_ASCII), given)) {
      throw new ResponseStatusException(
          HttpStatus.UNAUTHORIZED, "The link is not one this site sent.");
    }
    return subject;
  }

  /** The signature that follows a subject and a dot in a link the pipeline writes. */
  String sign(String subject) {
    try {
      Mac mac = Mac.getInstance(ALGORITHM);
      mac.init(new SecretKeySpec(secret, ALGORITHM));
      return HexFormat.of().formatHex(mac.doFinal(subject.getBytes(StandardCharsets.UTF_8)));
    } catch (GeneralSecurityException error) {
      throw new IllegalStateException("The link secret cannot sign.", error);
    }
  }
}
