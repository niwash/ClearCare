-- The Google listing each centre's photo comes from (ADR-0030). Flyway runs
-- this as clearcare_owner (ADR-0010). The roles it grants to are created by
-- infra/postgres/roles.sql.

-- The identifier, not the photo. Google's UI Kit renders the photo from this
-- identifier in the visitor's browser, so nothing of Google's is stored here.
-- An identifier may be kept without limit, unlike the coordinates in
-- clearcare.centre_location, which ADR-0027 deletes at 30 days; so there is no
-- expiry column and no job that deletes these rows.
CREATE TABLE clearcare.centre_image (
    centre_id text PRIMARY KEY REFERENCES clearcare.centre,
    -- Google's identifier for the business, not for its address.
    place_id text NOT NULL,
    -- When the listing was matched.
    updated_at timestamptz NOT NULL
);

-- A row means the centre has an image: the page renders Google's photo from
-- place_id. A centre with no row shows our placeholder, so only a listing the
-- rule accepted is ever written here. There is no rejected state to record.
--
-- place_id is deliberately not unique. Two centres in one campus can resolve
-- to the same Google listing, and a constraint would fail a correct match.
--
-- No index beyond the key: the only query is by centre_id.

GRANT SELECT, INSERT, UPDATE, DELETE
ON clearcare.centre_image
TO clearcare_pipeline;

-- No grant to clearcare_api. The migration that brings its first query of
-- these rows gives it a view, as V16 did for the points.
