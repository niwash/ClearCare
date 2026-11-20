-- The three generic packages a user can subscribe to, with the copy the site
-- shows (CCARE-265). Flyway runs this as clearcare_owner (ADR-0010).
--
-- V26 kept this migration seedless on purpose; the feature was inert until
-- these rows landed. ON CONFLICT DO NOTHING keeps the insert idempotent: an
-- environment that somehow holds a package row for a scope already keeps it.

INSERT INTO clearcare.alert_packages (title, description, scope, is_active) VALUES
    ('Alerts for a nursing home',
     'Get an email when a new inspection report is published for the nursing home you follow.',
     'CENTRE',
     true),
    ('Alerts for a county',
     'Get an email when a new inspection report is published in the county you follow.',
     'COUNTY',
     true),
    ('Alerts for every report',
     'Get an email whenever a new inspection report is published.',
     'ALL',
     true)
ON CONFLICT (scope) DO NOTHING;
