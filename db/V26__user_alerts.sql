-- The alert tables, created empty (ADR-0034).
-- Flyway runs this as clearcare_owner (ADR-0010). The roles it grants to are
-- created by infra/postgres/roles.sql.
--
-- No rows are inserted here. The catalogue is seeded by a later migration once
-- the dispatcher exists, and the runtime tables stay empty until then, so
-- applying this migration cannot offer a subscription nothing can send.

-- The catalogue of subscriptions the site will offer: one row per kind of thing
-- a visitor can ask to be told about.
--
-- `scope` is the machine name a subscription and an event are matched on, and it
-- is unique: two packages with the same scope would mean two different answers to
-- the same question. `title` is what the site shows, and `description` is the
-- longer line under it.
--
-- The rows are added by a later migration, all inactive: the columns and the
-- feature are not ready to be offered, and a package a visitor could pick before
-- the dispatcher understands it would silently collect subscriptions that never
-- fire. `is_active` defaults false so a package added without an explicit state
-- is not offered.
CREATE TABLE clearcare.alert_packages (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title text NOT NULL UNIQUE CHECK (title <> ''),
    description text,
    scope text NOT NULL UNIQUE CHECK (scope IN ('CENTRE', 'COUNTY', 'ALL')),
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- What one visitor asked to be told about.
--
-- `metadata` is a one-entry array naming the subject: `[{"center_id": "34",
-- "center_name": "..."}]` for a home, `[{"county_id": 11, "county_name":
-- "Cavan"}]` for a county, and `[]` for everything. The API builds it from the
-- route, checks the centre or county it names exists, and reads it back to show
-- the subscription. Storing the display name beside the id means the alert a
-- visitor receives can name the subject without a second lookup; the id is what
-- a rename is reconciled on.
--
-- A live row is unique on the person, the package and the document: asking twice
-- for the same home is one subscription, so the API upserts rather than piling
-- up rows. The uniqueness is only over live rows, so a person who unsubscribes
-- and subscribes again starts a fresh row while the old one stays readable.
--
-- Deactivating is not deleting: `deactivated_at` says when it stopped, and the
-- two fields are kept in step by the check below, so neither a live row with an
-- end date nor a dead row without one can be written.
CREATE TABLE clearcare.alert_subscriptions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES clearcare.users (id) ON DELETE CASCADE,
    alert_package_id integer NOT NULL REFERENCES clearcare.alert_packages (id),
    metadata jsonb NOT NULL CHECK (
        jsonb_typeof(metadata) = 'array'
        AND jsonb_array_length(metadata) <= 1
    ),
    is_active boolean NOT NULL DEFAULT true,
    deactivated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT alert_subscriptions_check CHECK (is_active = (deactivated_at IS NULL))
);

CREATE UNIQUE INDEX alert_subscriptions_active_key
    ON clearcare.alert_subscriptions (user_id, alert_package_id, metadata)
    WHERE is_active;

-- What the pipeline noticed in one ingest task, once per package.
--
-- `task_uuid` is the same for every event one ingest task writes, and the
-- unique key below is the package and that task: a task contributes at most one
-- event per package, however many centres or counties it covered. The subjects
-- it covered are in the `metadata` array: `[{"center_id": ..., "center_name":
-- ...}, ...]` for a facility event, `[{"county_id": ..., "county_name": ...}]`
-- for a county event, and `[]` for everything. There is deliberately no
-- report_id column: the context an email needs is carried in `metadata`.
--
-- `status` is the pipeline's own progress and the resolver owns its values;
-- `processed_at` says when it finished. There is no check pairing the two, so
-- the resolver can record a state change and its time without a second rule to
-- keep in step.
--
-- `user_id` is not here and must not be: an event is about what was ingested,
-- and which people it concerns is decided when it is resolved, by reading the
-- subscriptions of the moment.
CREATE TABLE clearcare.alert_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alert_package_id integer NOT NULL REFERENCES clearcare.alert_packages (id),
    task_uuid uuid NOT NULL,
    status text NOT NULL,
    metadata jsonb NOT NULL CHECK (jsonb_typeof(metadata) = 'array'),
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    CONSTRAINT alert_events_alert_package_id_task_uuid_key
        UNIQUE (alert_package_id, task_uuid)
);

-- The resolver's query is "the oldest unprocessed events", so the index only
-- covers those rows; a processed event never appears in it.
CREATE INDEX alert_events_unprocessed
    ON clearcare.alert_events (created_at)
    WHERE processed_at IS NULL;

-- What was sent to one person, and what it said.
--
-- `metadata` is one flattened subject per row, the alert the person actually
-- subscribed to: `{"center_id": ..., "center_name": ...}` or `{"county_id": ...,
-- "county_name": ...}`. `task_uuid` ties the row to the ingest task without a
-- foreign key to `alert_events`, so a notification can be explained after the
-- event that produced it has been pruned.
--
-- `status` is the sending state: pending is waiting, sent is done, skipped is a
-- subscription that no longer applies, failed needs a person. `processed_at` is
-- set when the row reaches a final state, and `retry_count` records how many
-- attempts it took. No address is stored here: the dispatcher reads it from
-- Cognito with AdminGetUser when it sends (ADR-0034), so the database never
-- holds a copy that can go stale or be missed by a deletion.
--
-- Rows belong to the person: deleting the account takes them (ON DELETE
-- CASCADE), which is what the deletion runbook promises.
CREATE TABLE clearcare.alert_notifications (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES clearcare.users (id) ON DELETE CASCADE,
    task_uuid uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
    metadata jsonb NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
    retry_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    CONSTRAINT alert_notifications_user_id_task_uuid_metadata_key
        UNIQUE (user_id, task_uuid, metadata)
);

-- The dispatcher's query is "the oldest pending or failed notifications", so the
-- index only covers those rows.
CREATE INDEX alert_notifications_unsent
    ON clearcare.alert_notifications (created_at)
    WHERE status IN ('pending', 'failed');

-- The link in an alert email that stops everything for one person.
--
-- One row per person, written by the pipeline when it sends and read by the API
-- when the link is opened. The token is opaque and is not the account id, so the
-- link can be forwarded without naming the account. Deleting the account takes
-- the row with it.
CREATE TABLE clearcare.alert_unsubscribe (
    user_id bigint PRIMARY KEY REFERENCES clearcare.users (id) ON DELETE CASCADE,
    token text NOT NULL DEFAULT (gen_random_uuid())::text UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- The API reads the catalogue and the counties it offers, writes a visitor's own
-- subscriptions, and reads the unsubscribe tokens. It never sees an event or a
-- notification.
GRANT SELECT ON clearcare.alert_packages TO clearcare_api;

GRANT SELECT, INSERT, UPDATE, DELETE
ON clearcare.alert_subscriptions
TO clearcare_api;

GRANT SELECT ON clearcare.alert_unsubscribe TO clearcare_api;

GRANT SELECT ON clearcare.county TO clearcare_api;

-- The identity column fills itself from a sequence, and a role that is not the
-- table's owner needs USAGE on it or every insert fails.
GRANT USAGE ON SEQUENCE clearcare.alert_subscriptions_id_seq TO clearcare_api;

-- The pipeline reads the catalogue, the subscriptions of the moment and the
-- counties, writes what it noticed and what it sent, and writes the unsubscribe
-- token before the email goes out. It does not write a subscription: a person's
-- choice is theirs.
GRANT SELECT
ON clearcare.alert_packages, clearcare.alert_subscriptions, clearcare.county
TO clearcare_pipeline;

GRANT SELECT, INSERT, UPDATE
ON clearcare.alert_events, clearcare.alert_notifications
TO clearcare_pipeline;

GRANT SELECT, INSERT ON clearcare.alert_unsubscribe TO clearcare_pipeline;

GRANT USAGE
ON SEQUENCE clearcare.alert_events_id_seq, clearcare.alert_notifications_id_seq
TO clearcare_pipeline;
