-- Each finding followed to the first later report of the same centre that
-- judges its regulation again, for the API (ADR-0009). Flyway runs this as
-- clearcare_owner (ADR-0010). ADR-0024 explains the definition. db/V4 stays
-- as it is for the statistics.

-- One row per finding. re_assessment_status is 're-assessed', with the report
-- that judged the regulation again; 'not re-assessed' when the centre has
-- later reports and none of them judges it; 'no later report'; or 'order
-- unknown' when the finding's report has no date, or the centre has two
-- reports on the date the regulation was judged again. The re-assessment
-- columns are null unless the status is 're-assessed'.
CREATE VIEW clearcare.finding_re_assessment AS
-- One judgment per regulation of a report, the lowest id, for the reason
-- db/V4 gives. Findings are picked only after this, so a regulation listed
-- twice is one finding.
WITH report_judgment AS (
    SELECT DISTINCT ON (report_id, regulation)
        report_id,
        regulation,
        title,
        judgment
    FROM clearcare.inspection_regulation
    ORDER BY report_id, regulation, id
),

-- Each centre's inspection dates and how many reports each has. When it has
-- one, report_id is that report. A report with no date cannot be put in
-- order, so it is never a later report.
inspection_day AS (
    SELECT
        centre_id,
        inspection_date,
        count(*) AS reports,
        CASE WHEN count(*) = 1 THEN min(id) END AS report_id
    FROM clearcare.inspection_report
    WHERE inspection_date IS NOT NULL
    GROUP BY centre_id, inspection_date
),

-- The dates on which a centre's reports judged a regulation, and the next
-- such date. Any judgment counts, including one printed other than HIQA's
-- three, so an unfamiliar value does not read as the regulation left out.
judged_day AS (
    SELECT
        centre_id,
        regulation,
        inspection_date,
        lead(inspection_date) OVER (
            PARTITION BY centre_id, regulation ORDER BY inspection_date
        ) AS next_judged_date
    FROM (
        SELECT DISTINCT
            inspection_report.centre_id,
            report_judgment.regulation,
            inspection_report.inspection_date
        FROM report_judgment
        INNER JOIN clearcare.inspection_report
            ON report_judgment.report_id = inspection_report.id
        WHERE inspection_report.inspection_date IS NOT NULL
    ) AS judged
),

finding AS (
    SELECT
        inspection_report.centre_id,
        inspection_report.id AS report_id,
        inspection_report.inspection_date,
        report_judgment.regulation,
        report_judgment.title,
        report_judgment.judgment
    FROM report_judgment
    INNER JOIN clearcare.inspection_report
        ON report_judgment.report_id = inspection_report.id
    WHERE
        lower(report_judgment.judgment)
        IN ('substantially compliant', 'not compliant')
)

SELECT
    finding.centre_id,
    finding.report_id,
    finding.inspection_date,
    finding.regulation,
    finding.title,
    finding.judgment,
    CASE
        WHEN
            finding.inspection_date IS NULL OR next_judged_day.reports > 1
            THEN 'order unknown'
        WHEN next_judged_day.reports = 1 THEN 're-assessed'
        WHEN EXISTS (
            SELECT FROM inspection_day AS later_day
            WHERE
                finding.centre_id = later_day.centre_id
                AND finding.inspection_date < later_day.inspection_date
        ) THEN 'not re-assessed'
        ELSE 'no later report'
    END AS re_assessment_status,
    re_assessment.report_id AS re_assessment_report_id,
    CASE
        WHEN re_assessment.report_id IS NOT NULL
            THEN next_judged_day.inspection_date
    END AS re_assessment_inspection_date,
    re_assessment.judgment AS re_assessment_judgment,
    CASE
        WHEN re_assessment.report_id IS NOT NULL THEN (
            SELECT count(*)
            FROM clearcare.inspection_report AS passed_over
            WHERE
                finding.centre_id = passed_over.centre_id
                AND finding.inspection_date < passed_over.inspection_date
                AND passed_over.inspection_date < next_judged_day.inspection_date
        )
    END AS reports_between
FROM finding
LEFT JOIN judged_day
    ON
        finding.centre_id = judged_day.centre_id
        AND finding.regulation = judged_day.regulation
        AND finding.inspection_date = judged_day.inspection_date
-- The date is found before the tie rule applies: when two reports share it,
-- which of them judged the regulation first is not known, and a later date
-- would not be the first judgment again.
LEFT JOIN inspection_day AS next_judged_day
    ON
        finding.centre_id = next_judged_day.centre_id
        AND judged_day.next_judged_date = next_judged_day.inspection_date
LEFT JOIN report_judgment AS re_assessment
    ON
        next_judged_day.report_id = re_assessment.report_id
        AND finding.regulation = re_assessment.regulation;

-- The API reads this view and nothing behind it, as with the views in db/V3.
GRANT SELECT ON clearcare.finding_re_assessment TO clearcare_api;
