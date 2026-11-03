-- V2 retains item-level evidence without changing existing v1 rows or views.
CREATE TABLE clearcare.report_amenities_v2 (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id bigint NOT NULL REFERENCES clearcare.inspection_report,
    amenities jsonb NOT NULL CHECK (
        jsonb_typeof(amenities) = 'object'
        AND amenities ?& ARRAY['care_types', 'room_types', 'activities', 'facilities']
        AND amenities - ARRAY['care_types', 'room_types', 'activities', 'facilities'] = '{}'::jsonb
        AND jsonb_typeof(amenities->'care_types') = 'array'
        AND jsonb_typeof(amenities->'room_types') = 'array'
        AND jsonb_typeof(amenities->'activities') = 'array'
        AND jsonb_typeof(amenities->'facilities') = 'array'
    ),
    file_name text NOT NULL CHECK (length(btrim(file_name)) > 0),
    hiqa_url text NOT NULL CHECK (length(btrim(hiqa_url)) > 0),
    extractor_version text NOT NULL CHECK (length(btrim(extractor_version)) > 0),
    model text NOT NULL CHECK (length(btrim(model)) > 0),
    -- No load-time default: provenance must come from the extraction file.
    extracted_at timestamptz NOT NULL,
    UNIQUE (report_id, extractor_version)
);

GRANT SELECT, INSERT ON clearcare.report_amenities_v2 TO clearcare_pipeline;

-- As in V11, choose the newest report with data, then its newest extraction.
CREATE VIEW clearcare.centre_amenities_v2 AS
SELECT DISTINCT ON (report.centre_id)
    report.centre_id,
    report.id AS report_id,
    report.inspection_date,
    amenities.amenities,
    amenities.extractor_version,
    amenities.model,
    amenities.extracted_at,
    source.sha256,
    amenities.file_name,
    amenities.hiqa_url
FROM clearcare.report_amenities_v2 AS amenities
INNER JOIN clearcare.inspection_report AS report ON report.id = amenities.report_id
INNER JOIN clearcare.source_file AS source USING (source_file_id)
ORDER BY report.centre_id, report.inspection_date DESC NULLS LAST,
    report.id, amenities.extracted_at DESC, amenities.id DESC;

GRANT SELECT ON clearcare.centre_amenities_v2 TO clearcare_api;
