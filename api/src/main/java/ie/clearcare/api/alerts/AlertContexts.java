package ie.clearcare.api.alerts;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;

/**
 * The context a subscription is stored with, and the check against the shape its package declared
 * (db/V26, ADR-0034).
 *
 * <p>Every context here is built from a path, never from a body, so a refusal means the packages and
 * this class have drifted apart: storing the row anyway would leave a subscription nothing can ever
 * match.
 */
final class AlertContexts {

  private AlertContexts() {}

  static Map<String, Object> facility(String centreId) {
    return Map.of("centre_id", centreId);
  }

  // The id, not the name: a county's spelling changes in three places and its id does not.
  static Map<String, Object> county(int countyId) {
    return Map.of("county_id", countyId);
  }

  static Map<String, Object> everything() {
    return Map.of();
  }

  /** Refuses a context its package's `context_schema` does not describe. */
  static void check(JsonNode schema, Map<String, Object> context) {
    JsonNode properties = schema.path("properties");
    for (JsonNode required : schema.path("required")) {
      if (!context.containsKey(required.asString())) {
        throw refuse("The package needs a " + required.asString() + ".");
      }
    }
    context.forEach(
        (name, value) -> {
          JsonNode property = properties.path(name);
          if (property.isMissingNode()) {
            throw refuse("The package does not describe a " + name + ".");
          }
          String type = property.path("type").asString("");
          boolean right =
              switch (type) {
                case "string" -> value instanceof String;
                case "integer" -> value instanceof Integer || value instanceof Long;
                case "number" -> value instanceof Number;
                case "" -> true;
                default -> false;
              };
          if (!right) {
            throw refuse("A " + name + " is not a " + type + ".");
          }
        });
  }

  private static ResponseStatusException refuse(String detail) {
    return new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, detail);
  }
}
