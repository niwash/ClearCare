-- Database roles for ClearCare (ADR-0010). Run once with psql, as a superuser,
-- on the clearcare database before the first migration. The postgres image runs
-- it from /docker-entrypoint-initdb.d when it creates a new database.
--
-- Passwords come from the environment and are never written here:
-- CLEARCARE_MIGRATOR_PASSWORD, CLEARCARE_PIPELINE_PASSWORD and
-- CLEARCARE_API_PASSWORD. If one is missing, psql leaves :'name' in the
-- statement as typed and stops on the syntax error. Everything runs in one
-- transaction, so a run that stops creates nothing.

\set ON_ERROR_STOP on
\getenv migrator_password CLEARCARE_MIGRATOR_PASSWORD
\getenv pipeline_password CLEARCARE_PIPELINE_PASSWORD
\getenv api_password CLEARCARE_API_PASSWORD

BEGIN;

-- Owns the database, the schema and everything the migrations create. Nobody
-- logs in as it.
CREATE ROLE clearcare_owner NOLOGIN;
ALTER DATABASE clearcare OWNER TO clearcare_owner;

-- Flyway logs in as the migrator and runs SET ROLE clearcare_owner first. The
-- membership does not pass on the owner's privileges until it does, so a
-- migration run without SET ROLE fails instead of creating objects that the
-- migrator owns.
CREATE ROLE clearcare_migrator LOGIN PASSWORD :'migrator_password';
GRANT clearcare_owner TO clearcare_migrator WITH INHERIT FALSE, SET TRUE;

-- The pipeline and the API get their privileges from the migrations.
CREATE ROLE clearcare_pipeline LOGIN PASSWORD :'pipeline_password';
CREATE ROLE clearcare_api LOGIN PASSWORD :'api_password';

COMMIT;
