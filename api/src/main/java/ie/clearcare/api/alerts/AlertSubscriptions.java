package ie.clearcare.api.alerts;

import java.util.List;

/**
 * The account's subscriptions, newest first, as {@code GET /alerts/subscriptions} returns them
 * (api/openapi.yaml). A wrapper rather than a bare array, so a later field can be added without
 * changing the document's shape.
 */
public record AlertSubscriptions(List<AlertSubscription> subscriptions) {

  public AlertSubscriptions {
    subscriptions = List.copyOf(subscriptions);
  }
}
