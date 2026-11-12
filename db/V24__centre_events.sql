-- The views behind a centre's record, the timeline of every public event
-- about the centre (ADR-0033), and behind the registration shown on the
-- centre's page. Flyway runs this as clearcare_owner (ADR-0010). The API
-- reads these views and not the tables behind them (ADR-0009). This migration
-- creates views and grants only.

-- One row per inspection of a centre that HIQA published a report of: each
-- report HIQA lists for the centre (db/V22), and each report read that it
-- lists no longer. HIQA takes old reports off a centre's page, and those read
-- before db/V22 kept the lists have no listed row, so their published_date is
-- NULL.
--
-- A listed report is joined to what was read from it by the hash of its file,
-- never by its date: the date HIQA lists can differ from the date the report
-- prints. inspection_kind says what was read: 'regulation inspection' with
-- report_id and the three counts, 'thematic inspection' with
-- overall_judgment, or NULL for a report ClearCare holds no reading of.
CREATE VIEW clearcare.centre_inspection AS
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
    read_report.overall_judgment
FROM clearcare.listed_report
-- The centre is part of the join so that a file listed on another centre's
-- page does not put that centre's report here.
FULL JOIN read_report
    ON
        listed_report.sha256 = read_report.sha256
        AND listed_report.centre_id = read_report.centre_id;

-- One row per change of a centre's contract price: a price that differs from
-- the centre's price in the list before, in the order ADR-0018 gives the
-- lists (date, then version). A centre's first price has no price before it
-- and is not a change. version is there to order two changes of one date.
CREATE VIEW clearcare.centre_price_change AS
SELECT
    centre_id,
    record_date,
    version,
    home_type,
    price_before,
    price_after
FROM (
    SELECT
        contract_price.centre_id,
        contract_price_list.record_date,
        contract_price_list.version,
        contract_price_list.home_type,
        contract_price.price AS price_after,
        lag(contract_price.price) OVER (
            PARTITION BY contract_price.centre_id
            ORDER BY
                contract_price_list.record_date,
                contract_price_list.version,
                contract_price.id
        ) AS price_before
    FROM clearcare.contract_price
    INNER JOIN clearcare.contract_price_list
        ON contract_price.list_id = contract_price_list.id
) AS centre_price
WHERE price_after <> price_before;

-- One row per register change (db/V21, ADR-0031), of every rules version:
-- whatever reads the view chooses one. change_date is the registration date
-- for a registration and, for every other kind, the day the change was first
-- shown. The registration number and the snapshot's hash stay out: nothing
-- shows them.
CREATE VIEW clearcare.centre_register_change AS
SELECT
    id AS register_change_id,
    centre_id,
    kind,
    change_date,
    condition_number,
    before_text,
    after_text,
    beds_before,
    beds_after,
    registered_until,
    rules_version
FROM clearcare.register_change;

-- One row per centre in the served snapshot: its registration as the
-- register prints it, and the Chief Inspector's note. The dates are NULL when
-- the snapshot was loaded before db/V21, and the note is NULL when there is
-- none.
CREATE VIEW clearcare.centre_registration AS
SELECT
    register_entry.centre_id,
    register_entry.registration_date,
    register_entry.registration_expiry_date,
    register_entry.chief_inspector_note
FROM clearcare.register_entry
INNER JOIN clearcare.register_publication USING (source_file_id);

-- One row per extra condition of a centre in the served snapshot. A snapshot
-- loaded before db/V21 has none, whatever its conditions were.
CREATE VIEW clearcare.centre_extra_condition AS
SELECT
    register_extra_condition.centre_id,
    register_extra_condition.number,
    register_extra_condition.text
FROM clearcare.register_extra_condition
INNER JOIN clearcare.register_publication USING (source_file_id);

-- As in db/V10, with the list's record_date added at the end, so that the
-- page can say which list the price is from. Replacing the view keeps its
-- grant to clearcare_api.
CREATE OR REPLACE VIEW clearcare.centre_contract_price AS
SELECT DISTINCT ON (contract_price.centre_id)
    contract_price.centre_id,
    contract_price.price,
    contract_price_list.home_type,
    contract_price_list.record_date
FROM clearcare.contract_price
INNER JOIN clearcare.contract_price_list
    ON contract_price_list.id = contract_price.list_id
ORDER BY
    contract_price.centre_id,
    contract_price_list.record_date DESC,
    contract_price_list.version DESC,
    contract_price.id DESC;

-- The API reads these views and nothing behind them, as with the views in
-- db/V3.
GRANT SELECT ON
    clearcare.centre_inspection,
    clearcare.centre_price_change,
    clearcare.centre_register_change,
    clearcare.centre_registration,
    clearcare.centre_extra_condition
TO clearcare_api;
