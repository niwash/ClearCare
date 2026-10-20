-- Parsed HIQA inspection reports, loaded by the pipeline (CCARE-34/35). Flyway
-- runs this as clearcare_owner (ADR-0010). The raw PDF a report was read from
-- is a row in clearcare.source_file (ADR-0007), written by the downloader.

-- One parsed report: the cover values the parser reads.
CREATE TABLE clearcare.inspection_report (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- The stored PDF this report was read from.
    source_file_id bigint NOT NULL REFERENCES clearcare.source_file,
    -- The centre the report is about: the number behind its Centre ID, which
    -- is how the register names centres (text, as clearcare.centre is).
    centre_id text NOT NULL REFERENCES clearcare.centre,
    -- The Centre ID as the report prints it, e.g. OSV-0000117.
    centre_code text NOT NULL,
    centre_name text NOT NULL,
    provider_name text,
    address text NOT NULL,
    inspection_type text,
    inspection_date date,
    -- HIQA's Fieldwork ID; together with the centre it names the report.
    fieldwork_id text NOT NULL,
    residents integer CHECK (residents >= 0),
    -- A stored file is loaded once, and a centre's fieldwork is one report.
    UNIQUE (source_file_id),
    UNIQUE (centre_id, fieldwork_id)
);

-- The inspectors named on the report.
CREATE TABLE clearcare.inspection_inspector (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id bigint NOT NULL REFERENCES clearcare.inspection_report,
    date date NOT NULL,
    start_time time,
    end_time time,
    name text NOT NULL,
    role text
);

-- The regulations considered, from Appendix 1. The regulation is kept as its
-- number and title: "Regulation 15: Staffing" -> "Regulation 15", "Staffing".
CREATE TABLE clearcare.inspection_regulation (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id bigint NOT NULL REFERENCES clearcare.inspection_report,
    regulation text NOT NULL,
    title text NOT NULL,
    judgment text NOT NULL
);

-- The compliance plan: what must change, and by when.
CREATE TABLE clearcare.inspection_compliance_item (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id bigint NOT NULL REFERENCES clearcare.inspection_report,
    regulation text NOT NULL,
    requirement text NOT NULL,
    judgment text,
    risk_rating text,
    date_to_comply date
);

-- The pipeline only adds rows.
GRANT SELECT, INSERT ON
    clearcare.inspection_report,
    clearcare.inspection_inspector,
    clearcare.inspection_regulation,
    clearcare.inspection_compliance_item
TO clearcare_pipeline;
