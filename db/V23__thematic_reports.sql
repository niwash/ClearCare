-- Thematic inspection reports, read by the ingest through a mapping of their
-- own (ADR-0032). Flyway runs this as clearcare_owner (ADR-0010).
--
-- A thematic inspection judges a centre against the National Standards and
-- ends with one overall judgment. Its report has no regulations, so it is not
-- a row of clearcare.inspection_report: the re-assessment views (ADR-0015,
-- ADR-0024) take a centre's next row there as its next report.
CREATE TABLE clearcare.thematic_report (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- The stored PDF this report was read from.
    source_file_id bigint NOT NULL REFERENCES clearcare.source_file,
    -- The number behind the Centre ID, as in clearcare.inspection_report.
    centre_id text NOT NULL REFERENCES clearcare.centre,
    -- The Centre ID as the report prints it, e.g. OSV-0000117.
    centre_code text NOT NULL,
    -- HIQA's "Type of inspection": whether the centre was told beforehand.
    inspection_type text NOT NULL,
    inspection_date date NOT NULL,
    -- HIQA's Fieldwork ID; together with the centre it names the report.
    fieldwork_id text NOT NULL,
    -- As the report prints it. No check on the words: which overall judgments
    -- there are is HIQA's to say.
    overall_judgment text NOT NULL,
    -- A stored file is loaded once, and a centre's fieldwork is one report.
    UNIQUE (source_file_id),
    UNIQUE (centre_id, fieldwork_id)
);

-- The cover also names the provider, who can be a person. That name is not
-- stored.

-- The pipeline only adds rows.
GRANT SELECT, INSERT ON clearcare.thematic_report TO clearcare_pipeline;

-- No grant to clearcare_api. The migration that brings its first query of
-- these rows gives it a view (ADR-0009).
