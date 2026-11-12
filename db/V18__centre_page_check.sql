-- When ClearCare last read each centre's page on hiqa.ie, where HIQA lists the
-- centre's reports, so that a home's record can say when it last looked for a
-- new one. Flyway runs this as clearcare_owner (ADR-0010).
--
-- The reports stage reads every registered centre's page each run and keeps
-- each read in its manifest. Only a read that worked is kept here: a page HIQA
-- would not serve, or one for another centre, was not a look at the reports.
CREATE TABLE clearcare.centre_page_check (
    centre_id text PRIMARY KEY REFERENCES clearcare.centre,
    checked_at timestamptz NOT NULL
);

-- The pipeline adds a centre's row and moves it on after a later read.
GRANT SELECT, INSERT, UPDATE ON clearcare.centre_page_check TO clearcare_pipeline;

-- The API reads views, not the tables behind them (ADR-0009).
CREATE VIEW clearcare.centre_hiqa_check AS
SELECT centre_id, checked_at
FROM clearcare.centre_page_check;

GRANT SELECT ON clearcare.centre_hiqa_check TO clearcare_api;
