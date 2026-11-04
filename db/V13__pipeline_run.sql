-- One row per pipeline run, so an operator can tell what ran and how it
-- ended without reading CloudWatch (ADR-0022). Flyway runs this as
-- clearcare_owner (ADR-0010).
--
-- A run inserts its row before it does anything else, so a task that is
-- killed leaves a row that is still 'running': that is how a run that never
-- ended is told from one that did. The schedule updates the row when the run
-- ends, whether it succeeded or failed.
CREATE TABLE clearcare.pipeline_run (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    -- 'incomplete' is a run that finished with work the next one retries: a
    -- crawl HIQA would not answer, or reports this version cannot read.
    -- 'failed' is the pipeline itself.
    outcome text NOT NULL DEFAULT 'running'
        CHECK (outcome IN ('running', 'succeeded', 'incomplete', 'failed')),
    exit_code integer,
    -- The first failure the run logged, for the reader who has no log.
    detail text,
    -- A row is open exactly while the run is: the schedule writes both
    -- columns together.
    CHECK ((outcome = 'running') = (finished_at IS NULL))
);

-- The last run is the one an operator asks about.
CREATE INDEX pipeline_run_recent ON clearcare.pipeline_run (started_at DESC);

-- The pipeline inserts the row and updates it once, when the run ends.
GRANT SELECT, INSERT, UPDATE ON clearcare.pipeline_run TO clearcare_pipeline;
