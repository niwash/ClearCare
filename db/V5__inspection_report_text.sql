-- Report text stays tied to the PDF and the pipeline version that cut it.
-- V4 belongs to CCARE-107.
CREATE TABLE clearcare.inspection_report_text (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id bigint NOT NULL REFERENCES clearcare.inspection_report,
    -- Summaries are the text that opens the Capacity and capability and the
    -- Quality and safety sections, before their first regulation heading.
    kind text NOT NULL CHECK (kind IN ('intro', 'capacity_summary',
        'narrative', 'quality_summary', 'response')),
    regulation text,
    first_page integer NOT NULL CHECK (first_page >= 1),
    last_page integer NOT NULL CHECK (last_page >= first_page),
    text text NOT NULL CHECK (length(btrim(text)) > 0),
    -- Character offset where each PDF page after first_page starts.
    -- Empty pages share the next page's offset. Single-page rows use {}.
    page_offsets integer[] NOT NULL,
    CHECK (cardinality(page_offsets) = last_page - first_page),
    CHECK (0 <= ALL(page_offsets) AND length(text) > ALL(page_offsets)),
    -- The text extractor's own version (EXTRACTOR_VERSION in parser/text.py),
    -- changed only with its mapping or code, not with each deploy.
    extractor_version text NOT NULL CHECK (length(btrim(extractor_version)) > 0),
    CHECK ((kind IN ('intro', 'capacity_summary', 'quality_summary'))
        = (regulation IS NULL)),
    UNIQUE NULLS NOT DISTINCT (report_id, kind, regulation, extractor_version)
);

-- The pipeline can read what is loaded and append a new extraction.
GRANT SELECT, INSERT ON clearcare.inspection_report_text TO clearcare_pipeline;

CREATE VIEW clearcare.report_text AS
SELECT id, report_id, kind, regulation, first_page, last_page, text,
    extractor_version, page_offsets
FROM clearcare.inspection_report_text;

-- The API reads the view and has no access to the underlying table (V3).
GRANT SELECT ON clearcare.report_text TO clearcare_api;
