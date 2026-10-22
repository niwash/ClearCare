CREATE TABLE clearcare.inspection_commitment (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    response_id bigint NOT NULL REFERENCES clearcare.inspection_report_text,
    sub_regulation text,
    -- Zero-based character offsets; end_offset is exclusive.
    start_offset integer NOT NULL CHECK (start_offset >= 0),
    end_offset integer NOT NULL CHECK (end_offset > start_offset),
    text text NOT NULL CHECK (length(text) = end_offset - start_offset),
    stated_deadline date,
    stated_deadline_text text,
    deadline_precision text CHECK (deadline_precision IN ('day', 'month')),
    page integer NOT NULL CHECK (page >= 1),
    last_page integer NOT NULL CHECK (last_page >= page),
    splitter_version text NOT NULL CHECK (length(btrim(splitter_version)) > 0),
    CHECK ((stated_deadline IS NULL) = (stated_deadline_text IS NULL)),
    CHECK ((stated_deadline IS NULL) = (deadline_precision IS NULL)),
    UNIQUE (response_id, splitter_version, start_offset)
);

GRANT SELECT, INSERT ON clearcare.inspection_commitment TO clearcare_pipeline;

CREATE VIEW clearcare.report_commitment AS
SELECT c.id, c.response_id, t.report_id, t.regulation, c.sub_regulation,
    c.start_offset, c.end_offset, c.text, c.stated_deadline,
    c.stated_deadline_text, c.deadline_precision, c.page, c.last_page,
    c.splitter_version, t.extractor_version
FROM clearcare.inspection_commitment c
JOIN clearcare.inspection_report_text t ON t.id = c.response_id;

GRANT SELECT ON clearcare.report_commitment TO clearcare_api;
