# The migration image for AWS: Flyway with the SQL files in db/ (ADR-0010).
# Build it with db/ as the context:
#   docker buildx build -f infra/aws/migrate/Dockerfile db
# compose.yaml mounts db/ into the same Flyway image instead.

FROM flyway/flyway:13.9.0
COPY *.sql /flyway/sql/
# The same settings as the migrate service in compose.yaml, which explains them.
# The connection (FLYWAY_URL, FLYWAY_USER, FLYWAY_PASSWORD) comes from the task.
ENV FLYWAY_LOCATIONS=filesystem:/flyway/sql \
    FLYWAY_DEFAULT_SCHEMA=public \
    FLYWAY_INIT_SQL="SET ROLE clearcare_owner"
# nobody: Flyway only reads its files.
USER 65534:65534
CMD ["migrate"]
