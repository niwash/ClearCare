-- Prices published under the Nursing Homes Support Scheme (CCARE-76). Flyway
-- runs this as clearcare_owner (ADR-0010). The PDF a list was read from is a
-- row in clearcare.source_file (ADR-0007), written by the loader.

-- One loaded price list. A loaded file is taken to be the complete list for
-- its date: a re-issued list is a new version of the same date, and the prices
-- of the version before it stay exactly as they were loaded.
CREATE TABLE clearcare.contract_price_list (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    home_type text NOT NULL CHECK (home_type IN ('public', 'private')),
    -- The date the prices belong to: the public list's "Effective from" line,
    -- the private list's "Date Modified".
    record_date date NOT NULL,
    -- The n-th distinct file loaded for this home type and date: 1 for the
    -- list as first published, 2 for a re-issue of it.
    version integer NOT NULL CHECK (version >= 1),
    source_file_id bigint NOT NULL REFERENCES clearcare.source_file,
    -- A stored file is loaded once, and a list is published once a version.
    UNIQUE (source_file_id),
    UNIQUE (home_type, record_date, version)
);

-- One centre's price in one loaded list.
CREATE TABLE clearcare.contract_price (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    list_id bigint NOT NULL REFERENCES clearcare.contract_price_list,
    -- The centre the price is for: the number behind its HIQA Center ID,
    -- which is how the register names centres (text, as clearcare.centre is).
    centre_id text NOT NULL REFERENCES clearcare.centre,
    -- Euro per resident per week, parsed from the "€1,220" the private list
    -- prints and the "1,908" the public list prints.
    price numeric(10,2) NOT NULL CHECK (price > 0),
    UNIQUE (list_id, centre_id)
);

-- The pipeline only adds rows.
GRANT SELECT, INSERT ON
    clearcare.contract_price_list,
    clearcare.contract_price
TO clearcare_pipeline;
