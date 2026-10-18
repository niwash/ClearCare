-- What each judgment of a report became at the centre's next report, for the
-- API (ADR-0009). Flyway runs this as clearcare_owner (ADR-0010). ADR-0015
-- explains the definition, and why it is not the glossary's re-assessment.

-- One row per regulation a report judged. next_result is the next report's
-- judgment of that regulation, 'not re-assessed' when the next report does not
-- list it, or 'no later report'. Judgments are passed on as printed, so a value
-- other than the three HIQA uses shows as a class of its own.
CREATE VIEW clearcare.next_inspection_result AS
-- Each centre's inspection dates and how many reports each has. When it has
-- one, report_id is that report. A report with no date cannot be put in order,
-- so it is neither an earlier nor a next report.
WITH inspection_day AS (
    SELECT
        centre_id,
        inspection_date,
        count(*) AS reports,
        min(id) AS report_id
    FROM clearcare.inspection_report
    WHERE inspection_date IS NOT NULL
    GROUP BY centre_id, inspection_date
),

next_inspection_day AS (
    SELECT
        centre_id,
        inspection_date,
        lead(inspection_date) OVER centre_days AS next_inspection_date,
        lead(report_id) OVER centre_days AS next_report_id,
        lead(reports) OVER centre_days AS next_reports
    FROM inspection_day
    WINDOW centre_days AS (PARTITION BY centre_id ORDER BY inspection_date)
),

-- The parser reads report MON-0042617 of centre 329 with each finding twice:
-- from Appendix 1, then again, capitalised, from the compliance plan. A
-- regulation's first row in report order (the lowest id, as in db/V3) is
-- Appendix 1's, so that is the one kept.
report_judgment AS (
    SELECT DISTINCT ON (report_id, regulation)
        report_id,
        regulation,
        judgment
    FROM clearcare.inspection_regulation
    ORDER BY report_id, regulation, id
)

SELECT
    inspection_report.centre_id,
    inspection_report.id AS report_id,
    next_inspection_day.next_report_id,
    inspection_report.inspection_date,
    next_inspection_day.next_inspection_date,
    next_inspection_day.next_inspection_date
    - inspection_report.inspection_date AS days_between,
    earlier.regulation,
    earlier.judgment,
    CASE
        WHEN next_inspection_day.next_report_id IS NULL THEN 'no later report'
        ELSE coalesce(later.judgment, 'not re-assessed')
    END AS next_result
FROM clearcare.inspection_report
INNER JOIN next_inspection_day USING (centre_id, inspection_date)
INNER JOIN report_judgment AS earlier
    ON inspection_report.id = earlier.report_id
LEFT JOIN report_judgment AS later
    ON
        next_inspection_day.next_report_id = later.report_id
        AND earlier.regulation = later.regulation
-- When two reports share the next date, neither is the next report, so the
-- earlier report is left out.
WHERE
    next_inspection_day.next_reports IS NULL
    OR next_inspection_day.next_reports = 1;

-- The API reads this view and nothing behind it, as with the views in db/V3.
GRANT SELECT ON clearcare.next_inspection_result TO clearcare_api;
