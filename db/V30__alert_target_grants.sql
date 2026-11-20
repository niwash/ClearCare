-- The alerts API checks that a subscription's target exists before it writes
-- the row: a centre_id names a row in clearcare.centre, a county_id a row in
-- clearcare.county (CCARE-270). V1 granted the API the views only, and V27
-- granted the county table to the pipeline, so neither table was readable by
-- the API until now. Both grants are read-only: the API never writes these.
GRANT SELECT ON clearcare.centre TO clearcare_api;
GRANT SELECT ON clearcare.county TO clearcare_api;
