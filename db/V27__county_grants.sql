-- The ingest that writes alert_events reads this table to resolve a report's
-- county (CCARE-266).
GRANT SELECT ON clearcare.county TO clearcare_pipeline;
