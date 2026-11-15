-- The 26 counties, as the register, the site and the alerts spell them
-- (CCARE-90). Flyway runs this as clearcare_owner (ADR-0010).
--
-- A lookup table, not a new source of truth for a snapshot: register_entry
-- keeps the county as HIQA printed it, and the pipeline's reader accepts only
-- these names. The same list is in the site's lib/counties.ts and the API's
-- County enum; this table gives the alerts a county id to reference and the
-- site a row to join, without changing what a register snapshot says.
--
-- No role is granted anything here yet: the ticket that reads the table adds
-- the grant it needs.

CREATE TABLE clearcare.county (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL UNIQUE CHECK (name <> '')
);

INSERT INTO clearcare.county (name) VALUES
    ('Carlow'),
    ('Cavan'),
    ('Clare'),
    ('Cork'),
    ('Donegal'),
    ('Dublin'),
    ('Galway'),
    ('Kerry'),
    ('Kildare'),
    ('Kilkenny'),
    ('Laois'),
    ('Leitrim'),
    ('Limerick'),
    ('Longford'),
    ('Louth'),
    ('Mayo'),
    ('Meath'),
    ('Monaghan'),
    ('Offaly'),
    ('Roscommon'),
    ('Sligo'),
    ('Tipperary'),
    ('Waterford'),
    ('Westmeath'),
    ('Wexford'),
    ('Wicklow');
