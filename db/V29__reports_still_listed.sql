-- Whether HIQA still lists each report, so that a centre's record can stop
-- linking to a file that is gone (ADR-0033). HIQA keeps three years of
-- reports on a centre's page and then takes them off, and the file then
-- answers 403: on 19 November 2026 that was so for all 43 reports published
-- on 15 November 2023. Flyway runs this as clearcare_owner (ADR-0010).

-- Whether the report was on the list of the centre's newest page read that
-- worked. The reports stage sets it on every load (db/V22), and sets it back
-- if HIQA lists the report again. Every row starts as listed: the first load
-- after this migration marks the reports that have already left.
ALTER TABLE clearcare.listed_report
ADD COLUMN still_listed boolean NOT NULL DEFAULT true;

-- As in db/V24, with still_listed added at the end. A report that leaves the
-- list from now on keeps its listed row, and so its published_date; only
-- still_listed says it is gone. Replacing the view keeps its grant to
-- clearcare_api, and the pipeline's grant on the table covers the new column.
CREATE OR REPLACE VIEW clearcare.centre_inspection AS
-- One judgment per regulation of a report, the lowest id, for the reason
-- db/V4 gives, counted by HIQA's three judgments.
WITH judgment_count AS (
    SELECT
        report_id,
        count(*) FILTER (
            WHERE lower(judgment) = 'compliant'
        ) AS compliant,
        count(*) FILTER (
            WHERE lower(judgment) = 'substantially compliant'
        ) AS substantially_compliant,
        count(*) FILTER (
            WHERE lower(judgment) = 'not compliant'
        ) AS not_compliant
    FROM (
        SELECT DISTINCT ON (report_id, regulation)
            report_id,
            judgment
        FROM clearcare.inspection_regulation
        ORDER BY report_id, regulation, id
    ) AS report_judgment
    GROUP BY report_id
),

-- Every report read, of either inspection kind, with the hash of its file.
read_report AS (
    SELECT
        source_file.sha256,
        source_file.url,
        inspection_report.centre_id,
        'regulation inspection' AS inspection_kind,
        inspection_report.inspection_type,
        inspection_report.inspection_date,
        inspection_report.id AS report_id,
        -- A report with no regulation read has no row to count.
        coalesce(judgment_count.compliant, 0) AS compliant,
        coalesce(judgment_count.substantially_compliant, 0)
            AS substantially_compliant,
        coalesce(judgment_count.not_compliant, 0) AS not_compliant,
        NULL AS overall_judgment
    FROM clearcare.inspection_report
    INNER JOIN clearcare.source_file USING (source_file_id)
    LEFT JOIN judgment_count
        ON inspection_report.id = judgment_count.report_id
    UNION ALL
    SELECT
        source_file.sha256,
        source_file.url,
        thematic_report.centre_id,
        'thematic inspection' AS inspection_kind,
        thematic_report.inspection_type,
        thematic_report.inspection_date,
        NULL AS report_id,
        NULL AS compliant,
        NULL AS substantially_compliant,
        NULL AS not_compliant,
        thematic_report.overall_judgment
    FROM clearcare.thematic_report
    INNER JOIN clearcare.source_file USING (source_file_id)
)

SELECT
    coalesce(listed_report.centre_id, read_report.centre_id) AS centre_id,
    -- HIQA's file.
    coalesce(listed_report.url, read_report.url) AS report_url,
    read_report.inspection_kind,
    -- The date the report prints, when it was read. Otherwise the date HIQA
    -- lists, unless it cannot be right: one before 2007, when HIQA was set
    -- up, or after the day the report was published. One listed date has
    -- the year 0026.
    coalesce(
        read_report.inspection_date,
        CASE
            WHEN
                listed_report.inspection_date
                BETWEEN DATE '2007-01-01' AND listed_report.published_date
                THEN listed_report.inspection_date
        END
    ) AS inspection_date,
    listed_report.published_date,
    read_report.inspection_type,
    read_report.report_id,
    read_report.compliant,
    read_report.substantially_compliant,
    read_report.not_compliant,
    read_report.overall_judgment,
    -- A report read with no listed row left HIQA's list before db/V22 kept
    -- the lists.
    coalesce(listed_report.still_listed, false) AS still_listed
FROM clearcare.listed_report
-- The centre is part of the join so that a file listed on another centre's
-- page does not put that centre's report here.
FULL JOIN read_report
    ON
        listed_report.sha256 = read_report.sha256
        AND listed_report.centre_id = read_report.centre_id;
