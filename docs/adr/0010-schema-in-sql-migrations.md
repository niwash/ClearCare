# The database schema changes only through SQL migrations

The pipeline writes to the database and the API reads from it, so neither of them owns the tables. Every schema change is a plain SQL file in `db/`, which Flyway applies as its own step before the pipeline or the API starts. Flyway logs in as `clearcare_migrator` and switches to `clearcare_owner`, the role that owns every table and view and that nobody logs in as. The pipeline and the API log in with their own roles, and each migration grants them only what they use. `infra/postgres/roles.sql` creates the roles once.

Spring Boot projects usually let the API migrate the database when it starts. Ours doesn't, because the API only reads. A schema change is then one reviewed file that both sides can read, and the API's credentials cannot change a table. The cost is an extra step before each deployment.
