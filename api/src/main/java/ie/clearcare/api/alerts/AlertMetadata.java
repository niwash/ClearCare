package ie.clearcare.api.alerts;

import java.util.Map;

/**
 * The metadata a subscription stores to name what it is about (db/V26, ADR-0034).
 *
 * <p>The document is built from the route, never from a body: {@code /alerts/facility/{centre_id}}
 * stores {@code {"centre_id": ...}}, {@code /alerts/county/{county}} stores
 * {@code {"county_id": ...}}, and {@code /alerts/all} stores {@code {}}. The API checks the centre
 * or county exists before writing.
 */
final class AlertMetadata {

  private AlertMetadata() {}

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
}
