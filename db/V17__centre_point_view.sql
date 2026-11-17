-- The centre locations the API may read, for search to sort by distance
-- (ADR-0026). Flyway runs this as clearcare_owner (ADR-0010).
--
-- Google's coordinates may be kept for 30 calendar days at most. The geocoder
-- deletes each point at 30 days, but only when it runs, so after a missed
-- daily run the table can still hold points that Google's terms no longer
-- allow. The view leaves them out by counting their age as the geocoder does,
-- in UTC calendar days (delete_expired in
-- pipeline/src/clearcare_pipeline/geocode/database.py, ADR-0027).
CREATE VIEW clearcare.centre_point AS
SELECT
    centre_location.centre_id,
    centre_location.point
FROM clearcare.centre_location
WHERE (now() AT TIME ZONE 'UTC')::date
    - (centre_location.geocoded_at AT TIME ZONE 'UTC')::date < 30;

-- The API reads this view and not the table behind it, as db/V16 says.
GRANT SELECT ON clearcare.centre_point TO clearcare_api;
