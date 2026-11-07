package ie.clearcare.api;

import org.testcontainers.utility.DockerImageName;

/** The database image, shared with compose.yaml and the pipeline tests. */
public final class DatabaseImage {

  // postgis/postgis:18-3.6 for linux/amd64. Testcontainers refuses a tag and a digest together, so
  // the digest stands alone. The PostgreSQL module accepts only images it knows, and this is the
  // postgres image with PostGIS added.
  public static final DockerImageName POSTGIS =
      DockerImageName.parse(
              "postgis/postgis@sha256:530bb81ad6c5993ae870ea66095d9dc758ef5866007186833f31fb2bebdd5791")
          .asCompatibleSubstituteFor("postgres");

  private DatabaseImage() {}
}
