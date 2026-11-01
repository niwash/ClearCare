# The migration image for AWS: Flyway with the SQL files in db/ (ADR-0010),
# run under the run lock a pipeline run also takes (ADR-0021).
#
# Build it with the repository root as the context, so that this folder's
# script is in it:
#   docker buildx build -f infra/aws/migrate/Dockerfile .
# compose.yaml mounts db/ into the same Flyway image instead, without the
# lock: the pipeline there is a long-running service, not a run.

FROM flyway/flyway:13.9.0
COPY db/*.sql /flyway/sql/

# psql holds the lock for the length of the migration: Flyway cannot hold a
# session-level advisory lock itself.
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY infra/aws/migrate/migrate-with-lock.sh /usr/local/bin/
# The Flyway image runs `flyway` itself as its entrypoint. The script takes
# its place, so that a task command such as `info` replaces the argument and
# not the script.
ENTRYPOINT ["/usr/local/bin/migrate-with-lock.sh"]

# The same settings as the migrate service in compose.yaml, which explains them.
# The connection (FLYWAY_URL, FLYWAY_USER, FLYWAY_PASSWORD) comes from the task.
ENV FLYWAY_LOCATIONS=filesystem:/flyway/sql \
    FLYWAY_DEFAULT_SCHEMA=public \
    FLYWAY_INIT_SQL="SET ROLE clearcare_owner"
CMD ["migrate"]
# nobody: Flyway only reads its files.
USER 65534:65534
