-- Register snapshots loaded from the raw store (ADR-0007) and the views the API
-- reads. Flyway runs this as clearcare_owner (ADR-0010). The roles it grants to
-- are created by infra/postgres/roles.sql.

CREATE SCHEMA clearcare;

-- Search ignores accents, so that "aras" finds "Áras".
CREATE EXTENSION unaccent SCHEMA clearcare;

-- One successful download, as recorded by one manifest line. The same bytes can
-- be downloaded on several days, and each download is its own row.
CREATE TABLE clearcare.source_file (
    source_file_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source text NOT NULL,
    url text NOT NULL,
    -- The file's name in the raw store.
    sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    fetched_at timestamptz NOT NULL,
    http_last_modified timestamptz,
    UNIQUE (source, url, fetched_at)
);

-- A centre, by its HIQA centre ID. Its name, address and the rest change over
-- time, so they are kept per snapshot in register_entry.
CREATE TABLE clearcare.centre (
    centre_id text PRIMARY KEY CHECK (centre_id ~ '^[0-9]+$')
);

-- One centre in one loaded register snapshot. Each loaded snapshot is stored in
-- full and never changed. The register's phone numbers, persons in charge and
-- management contacts are personal data and are not loaded.
CREATE TABLE clearcare.register_entry (
    source_file_id bigint NOT NULL REFERENCES clearcare.source_file,
    centre_id text NOT NULL REFERENCES clearcare.centre,
    -- Position of the record in the CSV file, the first after the header being 1.
    source_record integer NOT NULL CHECK (source_record >= 1),
    centre_name text NOT NULL,
    address text NOT NULL,
    county text NOT NULL,
    -- Taken from the end of the address; NULL when that is not a valid Eircode.
    eircode text CHECK (
        eircode ~ '^([AC-FHKNPRTV-Y][0-9]{2}|D6W)[0-9AC-FHKNPRTV-Y]{4}$'
    ),
    -- The most residents HIQA registered the centre for, not free beds.
    maximum_occupancy integer CHECK (maximum_occupancy >= 0),
    -- As written on the register. No view returns it yet, because some
    -- providers' names list individuals.
    provider_name text,
    provider_cro_number text,
    hiqa_url text NOT NULL,
    extracted_at timestamptz NOT NULL,
    -- Git commit of the pipeline that loaded the row.
    extractor_version text NOT NULL,
    PRIMARY KEY (source_file_id, centre_id),
    UNIQUE (source_file_id, source_record)
);

-- The snapshot the API serves. There is at most one row. The loader points it
-- at a snapshot in the transaction that inserts the snapshot, and rolling back
-- means pointing it at the previous one.
CREATE TABLE clearcare.register_publication (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    source_file_id bigint NOT NULL REFERENCES clearcare.source_file,
    published_at timestamptz NOT NULL
);

-- Text as search compares it: accents removed, lower case, apostrophes dropped
-- (so "Joseph's" and "Joseph’s" both become "josephs"), and every other run of
-- characters outside a-z and 0-9 turned into one space. The API calls this on
-- its parameters as well, so the rule is defined once. % and _ become spaces,
-- so user input can never act as a LIKE wildcard.
CREATE FUNCTION clearcare.search_key(value text) RETURNS text
LANGUAGE sql STABLE STRICT
RETURN btrim(
    regexp_replace(
        regexp_replace(
            lower(clearcare.unaccent('clearcare.unaccent', value)),
            '[''’‘`]', '', 'g'
        ),
        '[^a-z0-9]+', ' ', 'g'
    )
);

-- Where the served snapshot came from, for the source part of API responses.
CREATE VIEW clearcare.published_register_snapshot AS
SELECT
    source_file.fetched_at,
    source_file.sha256,
    source_file.url,
    register_publication.published_at
FROM clearcare.register_publication
INNER JOIN clearcare.source_file USING (source_file_id);

-- Centres in the served snapshot: the columns search returns, and the keys it
-- matches on.
CREATE VIEW clearcare.centre_search AS
SELECT
    register_entry.centre_id,
    register_entry.centre_name,
    register_entry.address,
    register_entry.county,
    register_entry.eircode,
    register_entry.maximum_occupancy,
    register_entry.hiqa_url,
    clearcare.search_key(register_entry.centre_name) AS name_key,
    clearcare.search_key(register_entry.address) AS address_key
FROM clearcare.register_entry
INNER JOIN clearcare.register_publication USING (source_file_id);

GRANT USAGE ON SCHEMA clearcare TO clearcare_pipeline, clearcare_api;

-- The pipeline only adds rows. Pointing the publication at a new snapshot is
-- its one update.
GRANT SELECT, INSERT
ON clearcare.source_file, clearcare.centre, clearcare.register_entry
TO clearcare_pipeline;
GRANT SELECT, INSERT, UPDATE
ON clearcare.register_publication
TO clearcare_pipeline;

-- The API reads the views and nothing else. A function called in a view runs
-- with the caller's privileges, so the API also needs search_key. PostgreSQL
-- lets everyone execute unaccent by default.
GRANT SELECT
ON clearcare.published_register_snapshot, clearcare.centre_search
TO clearcare_api;
REVOKE EXECUTE ON FUNCTION clearcare.search_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clearcare.search_key(text) TO clearcare_api;
