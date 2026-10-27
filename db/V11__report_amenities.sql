-- Amenities read from inspection reports (CCARE-85). Flyway runs this as
-- clearcare_owner (ADR-0010).

-- The "About the designated centre" section is kept as report text, beside the
-- other kinds (db/V5). It is the provider's own description of the centre, and
-- the main source of care types, room types and special units. It has no
-- regulation, as with the introduction and the section summaries.
--
-- Its rows carry their own extractor_version (about-v1), so the text-v1 rows
-- that the commitments split and the outcome pilot read are left as they are.
ALTER TABLE clearcare.inspection_report_text
    DROP CONSTRAINT inspection_report_text_kind_check,
    DROP CONSTRAINT inspection_report_text_check3;
ALTER TABLE clearcare.inspection_report_text
    ADD CONSTRAINT inspection_report_text_kind_check CHECK (kind IN (
        'about', 'intro', 'capacity_summary', 'narrative', 'quality_summary',
        'response'
    )),
    ADD CONSTRAINT inspection_report_text_regulation_check CHECK (
        (kind IN ('about', 'intro', 'capacity_summary', 'quality_summary'))
        = (regulation IS NULL)
    );

-- What a centre offers residents, as read from one report by one extraction.
-- Extractions are kept, not replaced: a re-run with a new model or prompt is a
-- new row, and the view below serves the newest.
CREATE TABLE clearcare.report_amenities (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id bigint NOT NULL REFERENCES clearcare.inspection_report,
    -- Lists hold the report's own wording, not yet normalised.
    care_types text[] NOT NULL,
    room_types text[] NOT NULL,
    -- TRUE when the report mentions it, NULL when it does not. A report that
    -- is silent about a garden does not show that the centre has none.
    has_outdoor_space boolean,
    activities text[] NOT NULL,
    has_transport boolean,
    has_chapel_or_religious_services boolean,
    special_units text[] NOT NULL,
    dining_notes text NOT NULL,
    other_notes text NOT NULL,
    -- Which extraction wrote the row, e.g. amenities-v0.
    extractor_version text NOT NULL CHECK (length(btrim(extractor_version)) > 0),
    -- The model behind it, e.g. gpt-4o-mini.
    model text NOT NULL CHECK (length(btrim(model)) > 0),
    extracted_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (report_id, extractor_version)
);

-- The pipeline only adds rows.
GRANT SELECT, INSERT ON clearcare.report_amenities TO clearcare_pipeline;

-- The amenities the API serves for each centre: the newest extraction of the
-- centre's newest report that has one. A report without a date comes last.
CREATE VIEW clearcare.centre_amenities AS
SELECT DISTINCT ON (report.centre_id)
    report.centre_id,
    report.id AS report_id,
    report.inspection_date,
    amenities.care_types,
    amenities.room_types,
    amenities.has_outdoor_space,
    amenities.activities,
    amenities.has_transport,
    amenities.has_chapel_or_religious_services,
    amenities.special_units,
    amenities.dining_notes,
    amenities.other_notes,
    amenities.extractor_version,
    amenities.model,
    amenities.extracted_at
FROM clearcare.report_amenities AS amenities
INNER JOIN clearcare.inspection_report AS report
    ON report.id = amenities.report_id
ORDER BY
    report.centre_id,
    report.inspection_date DESC NULLS LAST,
    report.id DESC,
    amenities.id DESC;

-- The API reads this view and nothing behind it, as with the views in db/V3.
GRANT SELECT ON clearcare.centre_amenities TO clearcare_api;
