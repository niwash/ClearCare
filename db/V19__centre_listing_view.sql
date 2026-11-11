-- The Google listing each centre's photo comes from, as the API may read it
-- (ADR-0030). Flyway runs this as clearcare_owner (ADR-0010).
--
-- The API reads this view and not the table behind it, as db/V18 says. Unlike
-- clearcare.centre_point, it carries no age limit: Google's terms put no
-- expiry on a place identifier, so nothing has to be left out (ADR-0027).
-- updated_at stays out of the view: it is how the pipeline knows when it last
-- matched a centre, and the page shows nothing from it.
CREATE VIEW clearcare.centre_listing AS
SELECT
    centre_image.centre_id,
    centre_image.place_id
FROM clearcare.centre_image;

GRANT SELECT ON clearcare.centre_listing TO clearcare_api;
