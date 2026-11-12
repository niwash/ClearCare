-- What changed on the register, found by comparing its stored snapshots
-- (ADR-0031), and the registration columns and extra conditions that the
-- comparison reads. Flyway runs this as clearcare_owner (ADR-0010). The role
-- it grants to is created by infra/postgres/roles.sql.

-- The centre's registration, as the register prints it. Rows loaded before
-- this migration have NULL in all four columns.
ALTER TABLE clearcare.register_entry
ADD COLUMN registration_number text,
ADD COLUMN registration_date date,
ADD COLUMN registration_expiry_date date,
-- The Chief Inspector's note on the registration. NULL when there is none.
ADD COLUMN chief_inspector_note text;

-- One extra condition of registration of one centre in one loaded snapshot.
-- Nearly every centre has the same three conditions, so the column is not
-- stored whole; the file in the raw store has it (ADR-0007). The extras are
-- every condition numbered 4 or more, and condition 3 when it says more than
-- the maximum number of residents
-- (pipeline/src/clearcare_pipeline/load_register/conditions.py). A snapshot
-- loaded before this migration has no rows here, whatever its conditions were.
CREATE TABLE clearcare.register_extra_condition (
    source_file_id bigint NOT NULL,
    centre_id text NOT NULL,
    -- The condition's number on the register.
    number integer NOT NULL CHECK (number >= 3),
    -- HIQA's words, with each run of whitespace as one space.
    text text NOT NULL,
    PRIMARY KEY (source_file_id, centre_id, number),
    FOREIGN KEY (source_file_id, centre_id)
    REFERENCES clearcare.register_entry (source_file_id, centre_id)
);

-- One change to a centre's register entry, found by the pipeline's
-- register_changes stage. Rows are only added. A change to the rules is a new
-- rules_version, and its rows are added beside the earlier version's, as
-- the commitments are (db/V6).
CREATE TABLE clearcare.register_change (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    centre_id text NOT NULL REFERENCES clearcare.centre,
    kind text NOT NULL CHECK (
        kind IN (
            'registration',
            'provider',
            'name',
            'beds',
            'condition_added',
            'condition_removed',
            'condition_changed',
            'note_added',
            'note_removed'
        )
    ),
    -- A registration's own date. For every other kind it is shown_on: the
    -- register does not say when a change happened.
    change_date date NOT NULL,
    -- The Irish day the first snapshot with the change was fetched.
    shown_on date NOT NULL,
    -- That snapshot's file in the raw store. It is not a source_file row,
    -- because the stage compares every stored snapshot and most of the
    -- earlier ones were never loaded.
    snapshot_sha256 text NOT NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
    -- One column per field. A kind leaves the ones it does not use NULL.
    -- The number of the extra condition added, removed or changed.
    condition_number integer,
    -- The earlier and the later provider, centre name, condition or note. A
    -- provider is named only if it has a CRO number, so only companies are.
    before_text text,
    after_text text,
    -- The earlier and the later maximum occupancy.
    beds_before integer,
    beds_after integer,
    -- A registration's expiry date and number.
    registered_until date,
    registration_number text,
    rules_version text NOT NULL CHECK (length(btrim(rules_version)) > 0),
    CHECK (
        (
            kind IN (
                'condition_added', 'condition_removed', 'condition_changed'
            )
        ) = (condition_number IS NOT NULL)
    ),
    CHECK (
        (kind = 'registration')
        = (registered_until IS NOT NULL AND registration_number IS NOT NULL)
    ),
    -- What a repeat run finds again and must not add twice. shown_on is in
    -- the key because HIQA's file can go back to bytes it had before: the same
    -- file fetched on a later day holds another change. Most kinds have no
    -- condition number, and their rows must still count as the same.
    UNIQUE NULLS NOT DISTINCT (
        rules_version,
        centre_id,
        kind,
        snapshot_sha256,
        shown_on,
        condition_number
    )
);

-- The pipeline only adds rows.
GRANT SELECT, INSERT
ON clearcare.register_extra_condition, clearcare.register_change
TO clearcare_pipeline;

-- No grant to clearcare_api. The migration that brings its first query of
-- these rows gives it a view, as V20 did for the centre images.
