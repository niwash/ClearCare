package ie.clearcare.api.alerts;

import java.util.List;

/**
 * The packages the site may offer, as {@code GET /alerts/packages} returns them (api/openapi.yaml).
 * A wrapper rather than a bare array, as {@link AlertSubscriptions} is, so a later field can be
 * added without changing the document's shape.
 */
public record AlertPackages(List<AlertPackage> packages) {

  public AlertPackages {
    packages = List.copyOf(packages);
  }
}
