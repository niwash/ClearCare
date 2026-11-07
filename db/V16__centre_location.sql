-- Where each centre is, so that search can sort centres by straight-line
-- distance and show them on a map (ADR-0026). Flyway runs this as
-- clearcare_owner (ADR-0010). The roles it grants to are created by
-- infra/postgres/roles.sql.

-- Installing PostGIS needs a superuser, or rds_superuser on RDS, and
-- clearcare_owner is neither, so the administrator installs it once before
-- this runs (ADR-0026). Without it, stop here with the step to take rather
-- than fail later on an unknown type.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_extension WHERE extname = 'postgis') THEN
        RAISE EXCEPTION 'V16 needs the postgis extension, which database % does not have', current_database()
            USING HINT = 'Run CREATE EXTENSION postgis in this database as a superuser (rds_superuser on RDS), then migrate again. CONTRIBUTING.md and infra/aws/README.md give the command.';
    END IF;
END
$$;

-- Google's coordinates may be kept for 30 days at most, and its place_id
-- without limit; the geocoder replaces or deletes each point before then,
-- going by geocoded_at (ADR-0026).
CREATE TABLE clearcare.centre_location (
    centre_id text PRIMARY KEY REFERENCES clearcare.centre,
    -- geography rather than geometry, so that ST_Distance answers in metres
    -- on the earth's surface without choosing a projection.
    point geography(Point, 4326) NOT NULL,
    place_id text NOT NULL,
    geocoded_at timestamptz NOT NULL
);

-- No spatial index: search sorts every centre by its exact ST_Distance from
-- one place, which reads all of the roughly 550 rows whether there is an index
-- or not.

-- The pipeline adds a point, replaces it when it geocodes the centre again, and
-- deletes it when it may no longer keep it.
GRANT SELECT, INSERT, UPDATE, DELETE
ON clearcare.centre_location
TO clearcare_pipeline;

-- The first reader of the points must ignore expired ones.
GRANT SELECT
ON clearcare.centre_location
TO clearcare_api;
