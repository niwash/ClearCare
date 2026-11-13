-- Every report HIQA lists on a centre's page, whether or not ClearCare holds
-- or can read its file, so that a centre's record can show each published
-- report and the day it was published. Flyway runs this as clearcare_owner
-- (ADR-0010).
--
-- The reports stage reads the list on every crawl and keeps it in its
-- manifest. Each centre's rows here are the list of its newest page read that
-- worked. A report that HIQA takes off its list stays here. HIQA does take
-- old reports off a centre's page: 32 reports read in October 2026 were no
-- longer listed a month later, before this table kept the lists.
CREATE TABLE clearcare.listed_report (
    centre_id text NOT NULL REFERENCES clearcare.centre,
    -- Where the report's file is downloaded from.
    url text NOT NULL,
    file_name text NOT NULL,
    -- The first day of the inspection, as HIQA lists it. It can differ from
    -- the report's own date by a few days and one row has the year 0026, so
    -- whatever reads it decides which date to show.
    inspection_date date NOT NULL,
    published_date date NOT NULL,
    -- HIQA's "Report type" column. It names the kind of centre, such as
    -- "Nursing Homes", and not the inspection kind.
    report_type text NOT NULL,
    -- Our copy of the file in the raw store (ADR-0007). NULL until there is
    -- one. Not unique: HIQA lists some files under two names.
    sha256 text CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    PRIMARY KEY (centre_id, url)
);

-- The pipeline adds a centre's rows and changes one when HIQA lists the
-- report with other values or its file is stored.
GRANT SELECT, INSERT, UPDATE ON clearcare.listed_report TO clearcare_pipeline;

-- No grant to clearcare_api. The migration that brings its first query of
-- these rows gives it a view (ADR-0009).
