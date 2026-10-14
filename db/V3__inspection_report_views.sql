-- The inspection-report views the API reads (ADR-0009). Flyway runs this as
-- clearcare_owner (ADR-0010). The pipeline owns the tables (db/V2) and the API
-- is granted SELECT on these views and nothing else.

-- One parsed report, with the raw PDF it was read from. The report's own id is
-- exposed as report_id, which is what the child tables call it.
CREATE VIEW clearcare.centre_report AS
SELECT
    inspection_report.id AS report_id,
    inspection_report.centre_id,
    inspection_report.centre_code,
    inspection_report.centre_name,
    inspection_report.provider_name,
    inspection_report.address,
    inspection_report.inspection_type,
    inspection_report.inspection_date,
    inspection_report.fieldwork_id,
    inspection_report.residents,
    source_file.sha256 AS report_sha256,
    source_file.url AS report_url,
    source_file.fetched_at AS report_fetched_at
FROM clearcare.inspection_report
INNER JOIN clearcare.source_file USING (source_file_id);

-- The inspectors a report names, in the order the report prints them. The id is
-- the insertion order, which is that order; no other column carries it.
CREATE VIEW clearcare.report_inspector AS
SELECT id, report_id, date, start_time, end_time, name, role
FROM clearcare.inspection_inspector;

-- The regulations a report considered, from Appendix 1, in report order.
CREATE VIEW clearcare.report_regulation AS
SELECT id, report_id, regulation, title, judgment
FROM clearcare.inspection_regulation;

-- The compliance plan: what must change, and by when, in report order.
CREATE VIEW clearcare.report_compliance_item AS
SELECT id, report_id, regulation, requirement, judgment, risk_rating, date_to_comply
FROM clearcare.inspection_compliance_item;

-- The API reads the views and nothing else (ADR-0009). The pipeline already
-- holds INSERT on the tables (db/V2) and is not granted these.
GRANT SELECT ON
    clearcare.centre_report,
    clearcare.report_inspector,
    clearcare.report_regulation,
    clearcare.report_compliance_item
TO clearcare_api;
