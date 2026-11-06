-- Saved searches of a signed-in visitor (ADR-0025). Flyway runs this as
-- clearcare_owner (ADR-0010). The roles it grants to are created by
-- infra/postgres/roles.sql.

-- An account the site has written something for. Cognito owns the account
-- itself; this table only gives it a local key, so rows that belong to one
-- person reference a number rather than repeating the subject claim on every
-- table the site adds.
--
-- The subject claim is the only identity stored: no name, no email, no address.
-- It is unique and stable within a pool, and it is what the web server takes
-- from its own encrypted session (ADR-0020).
CREATE TABLE clearcare.users (
    -- PostgreSQL's own default for an id: an identity column, filled in by the
    -- database and never written by the application.
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cognito_sub text NOT NULL UNIQUE CHECK (cognito_sub ~ '^[A-Za-z0-9_-]{1,128}$'),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- What the search page remembers for one account: the county, the order and the
-- filter options the visitor saved, so they do not have to tick them again on
-- their next visit.
--
-- This is the only table clearcare_api writes, and it is written for a visitor's
-- own choosing rather than for HIQA data, which is the boundary ADR-0010 keeps:
-- the pipeline still owns everything read from a report or a register.
--
-- One document rather than a column per filter: the site's filter options change
-- without a release here, and the API stores what it is given without reading
-- its meaning. The web drops an option the site no longer offers, and the API
-- refuses a document that is not shaped like one.
--
-- One row per account, so the key is the account's id and not an identity of its
-- own: an account that goes takes its saved search with it.
CREATE TABLE clearcare.user_preferences (
    user_id bigint PRIMARY KEY REFERENCES clearcare.users (id) ON DELETE CASCADE,
    preferences jsonb NOT NULL CHECK (
        jsonb_typeof(preferences) = 'object'
        AND length(preferences::text) <= 4096
    ),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- No pipeline role is granted anything here: a saved search is not extracted
-- data, so nothing under pipeline/src reads or writes these tables.

-- The API writes an account row the first time a visitor saves, and reads it back
-- to find the row to replace. It is not granted DELETE here yet: removing an
-- account is the deletion route ADR-0025 leaves to later, not a saved search.
GRANT SELECT, INSERT, UPDATE
ON clearcare.users
TO clearcare_api;

-- An identity column fills itself from a sequence, and a role that is not the
-- table's owner needs USAGE on that sequence or every insert fails.
GRANT USAGE ON SEQUENCE clearcare.users_id_seq TO clearcare_api;

GRANT SELECT, INSERT, UPDATE, DELETE
ON clearcare.user_preferences
TO clearcare_api;
