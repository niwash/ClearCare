package ie.clearcare.api;

import java.nio.file.Path;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.MountableFile;

/**
 * The same database as compose.yaml and the pipeline tests, written out in each place: the image,
 * and a new database set up from it as Compose sets one up.
 */
public final class DatabaseImage {

  // postgis/postgis:18-3.6 for linux/amd64. Testcontainers refuses a tag and a digest together, so
  // the digest stands alone. The PostgreSQL module accepts only images it knows, and this is the
  // postgres image with PostGIS added.
  public static final DockerImageName POSTGIS =
      DockerImageName.parse(
              "postgis/postgis@sha256:530bb81ad6c5993ae870ea66095d9dc758ef5866007186833f31fb2bebdd5791")
          .asCompatibleSubstituteFor("postgres");

  // Maven runs the tests in api/.
  private static final Path REPOSITORY = Path.of("..");

  /**
   * A database named clearcare, set up by the image's init scripts as a new local database is.
   * postgis.sh replaces the image's own 10_postgis.sh, which also installs three extensions RDS
   * lacks, and is copied executable so that the entrypoint runs it rather than sourcing it.
   * roles.sql creates the roles, each with this password.
   */
  public static PostgreSQLContainer newDatabase(String password) {
    return new PostgreSQLContainer(POSTGIS)
        .withDatabaseName("clearcare")
        .withCopyFileToContainer(
            MountableFile.forHostPath(REPOSITORY.resolve("infra/postgres/postgis.sh"), 0755),
            "/docker-entrypoint-initdb.d/10_postgis.sh")
        .withCopyFileToContainer(
            MountableFile.forHostPath(REPOSITORY.resolve("infra/postgres/roles.sql")),
            "/docker-entrypoint-initdb.d/roles.sql")
        .withEnv("CLEARCARE_MIGRATOR_PASSWORD", password)
        .withEnv("CLEARCARE_PIPELINE_PASSWORD", password)
        .withEnv("CLEARCARE_API_PASSWORD", password);
  }

  private DatabaseImage() {}
}
