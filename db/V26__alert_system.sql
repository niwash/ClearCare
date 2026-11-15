-- Subscriptions to alerts and what the pipeline noticed and sent (ADR-0034).
-- Flyway runs this as clearcare_owner (ADR-0010). The roles it grants to are
-- created by infra/postgres/roles.sql.

-- The catalogue of subscriptions the site offers: one row per kind of thing a
-- visitor can ask to be told about.
--
-- `scope` is the machine name a subscription and an event are matched on, and it
-- is unique: two packages with the same scope would mean two different answers to
-- the same question. `name` is what the site shows, and `context_schema` is the
-- shape the API checks a subscription's context against before storing it, so the
-- site's form and the API's check cannot drift apart.
--
-- Rotation is seeded inactive: the columns are settled, the feature is not, and a
-- package a visitor can pick before the dispatcher understands it would silently
-- collect subscriptions that never fire. An inactive package is kept out of the
-- API's list.
--
-- The rows are seeded below and never written at runtime. Their ids are part of
-- the data other tables reference, so a later migration must keep them.
CREATE TABLE clearcare.alert_packages (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL UNIQUE CHECK (name <> ''),
    scope text NOT NULL UNIQUE CHECK (scope IN ('FACILITY', 'COUNTY', 'RADIUS', 'ALL')),
    context_schema jsonb NOT NULL CHECK (jsonb_typeof(context_schema) = 'object'),
    is_active boolean NOT NULL DEFAULT true,
    -- Used by the RADIUS package only: the point it was seeded with and how far
    -- around it the visitor's own subscription reaches.
    latitude double precision,
    longitude double precision,
    radius_miles numeric(6, 2) CHECK (radius_miles IS NULL OR radius_miles > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    -- A seeded radius package that cannot place itself is a package that cannot
    -- match, so the three columns are all present or all absent.
    CONSTRAINT alert_packages_radius_complete CHECK (
        scope <> 'RADIUS'
        OR (latitude IS NOT NULL AND longitude IS NOT NULL AND radius_miles IS NOT NULL)
    )
);

-- Four packages: a single home, a county, everything, and the rotation that is
-- not offered yet.
--
-- A county is named by an integer id from clearcare.county (CCARE-90, V25) rather
-- than by a string, because the same twenty-six names are spelled three times
-- already and a subscription must not stop matching when one of them changes.
INSERT INTO clearcare.alert_packages (name, scope, context_schema, is_active)
VALUES
    (
        'A home I follow',
        'FACILITY',
        '{"type": "object", "required": ["centre_id"], "properties": {"centre_id": {"type": "string", "minLength": 1}}, "additionalProperties": false}',
        true
    ),
    (
        'A county',
        'COUNTY',
        '{"type": "object", "required": ["county_id"], "properties": {"county_id": {"type": "integer", "minimum": 1}}, "additionalProperties": false}',
        true
    ),
    (
        'Every home',
        'ALL',
        '{"type": "object", "properties": {}, "additionalProperties": false}',
        true
    );

-- The rotation package, seeded off, with a point in Dublin and twenty-five miles
-- as an example of the shape it will take.
INSERT INTO clearcare.alert_packages (name, scope, context_schema, is_active, latitude, longitude, radius_miles)
VALUES (
    'Near a place',
    'RADIUS',
    '{"type": "object", "required": ["latitude", "longitude"], "properties": {"latitude": {"type": "number"}, "longitude": {"type": "number"}}, "additionalProperties": false}',
    false,
    53.3498,
    -6.2603,
    25.00
);

-- What one visitor asked to be told about.
--
-- The natural key is the person, the package and the context they chose: asking
-- twice for the same home is the same subscription, so the API upserts rather
-- than piling up rows, and a person who unsubscribes and subscribes again
-- reactivates the row they had, keeping the notifications under it readable.
--
-- Deactivating is not deleting: `deactivated_at` says when it stopped, and the
-- two fields are kept in step by the check below, so neither a live row with an
-- end date nor a dead row without one can be written.
--
-- The context is a document because the three scopes describe different things
-- (a home, a county, nothing at all); the API checks its shape against the
-- package's `context_schema` before storing it.
CREATE TABLE clearcare.alert_subscriptions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES clearcare.users (id) ON DELETE CASCADE,
    alert_package_id integer NOT NULL REFERENCES clearcare.alert_packages (id),
    context jsonb NOT NULL CHECK (
        jsonb_typeof(context) = 'object'
        AND length(context::text) <= 1024
    ),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
        jsonb_typeof(metadata) = 'object'
        AND length(metadata::text) <= 1024
    ),
    is_active boolean NOT NULL DEFAULT true,
    deactivated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT alert_subscriptions_natural_key
        UNIQUE (user_id, alert_package_id, context),
    CONSTRAINT alert_subscriptions_deactivation_paired CHECK (
        (is_active AND deactivated_at IS NULL)
        OR (NOT is_active AND deactivated_at IS NOT NULL)
    )
);

-- What the pipeline noticed in one ingest batch, once per scope value.
--
-- One row per package and value in the batch, never one per report: twelve new
-- reports for a county are one county event and one whole-register event, with
-- the report ids in `metadata`. There is deliberately no report_id column: the
-- resolver matches an event to a subscription by containment (`event.context
-- @> subscription.context`), which describes the batch rather than a report.
--
-- `status` is the pipeline's own progress: PENDING is picked up by the resolver,
-- PROCESSING is held while its notifications are written, PROCESSED is finished,
-- and `processed_at` says when.
--
-- `user_id` is not here and must not be: an event is about a report, and which
-- people it concerns is decided when it is resolved, by reading the
-- subscriptions of the moment.
CREATE TABLE clearcare.alert_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alert_package_id integer NOT NULL REFERENCES clearcare.alert_packages (id),
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED')),
    context jsonb NOT NULL CHECK (jsonb_typeof(context) = 'object'),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    CONSTRAINT alert_events_processed_at_paired CHECK (
        (status = 'PROCESSED' AND processed_at IS NOT NULL)
        OR (status <> 'PROCESSED' AND processed_at IS NULL)
    )
);

-- The resolver's query is "the oldest pending events", so the index only covers
-- those rows; a processed event never appears in it.
CREATE INDEX alert_events_pending_idx
    ON clearcare.alert_events (created_at)
    WHERE status = 'PENDING';

-- The containment join, `event.context @> subscription.context`, reads contexts
-- on both sides; this is the one that is looked up by value.
CREATE INDEX alert_events_context_idx
    ON clearcare.alert_events USING gin (context jsonb_path_ops);

-- What was sent to one person, and what it said.
--
-- `context` holds the package and value the email is attributed to, and the
-- report ids it carried, so a notification can be explained without the event it
-- came from being replayed. `status` is the sending state: QUEUED is waiting,
-- SENDING is with the sender, SENT is done, FAILED needs a person. `sent_at` is
-- set with SENT, and `retry_count` records how many attempts it took.
--
-- No address is stored here: the dispatcher reads it from Cognito with
-- AdminGetUser when it sends (ADR-0034), so the database never holds a copy that
-- can go stale or be missed by a deletion.
--
-- Rows belong to the person: deleting the account takes them (ON DELETE CASCADE),
-- which is what the deletion runbook promises.
CREATE TABLE clearcare.alert_notifications (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES clearcare.users (id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENDING', 'SENT', 'FAILED')),
    context jsonb NOT NULL CHECK (jsonb_typeof(context) = 'object'),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
    retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    CONSTRAINT alert_notifications_sent_at_paired CHECK (
        (status = 'SENT' AND sent_at IS NOT NULL)
        OR (status <> 'SENT')
    )
);

-- The dispatcher's query is "the oldest queued notifications", and a crashed run
-- leaves rows in SENDING that the retry picks up, so both states are covered.
CREATE INDEX alert_notifications_queue_idx
    ON clearcare.alert_notifications (created_at)
    WHERE status IN ('QUEUED', 'SENDING');

-- One index per person, so the account page and the deletion path can both find
-- a visitor's rows without reading the table.
CREATE INDEX alert_notifications_user_idx
    ON clearcare.alert_notifications (user_id);

CREATE INDEX alert_subscriptions_user_idx
    ON clearcare.alert_subscriptions (user_id)
    WHERE is_active;

-- The API reads the catalogue and the counties it offers, writes a visitor's own
-- subscriptions, and never sees an event or a notification.
GRANT SELECT, INSERT, UPDATE
ON clearcare.alert_subscriptions
TO clearcare_api;

GRANT SELECT ON clearcare.alert_packages TO clearcare_api;
GRANT SELECT ON clearcare.county TO clearcare_api;

-- The identity column fills itself from a sequence, and a role that is not the
-- table's owner needs USAGE on it or every insert fails.
GRANT USAGE ON SEQUENCE clearcare.alert_subscriptions_id_seq TO clearcare_api;

-- The pipeline reads the catalogue, the subscriptions of the moment, the account
-- the subscription belongs to and the counties, and writes what it noticed and
-- what it sent. It does not write a subscription: a person's choice is theirs.
GRANT SELECT
ON clearcare.alert_packages, clearcare.alert_subscriptions, clearcare.users, clearcare.county
TO clearcare_pipeline;

GRANT SELECT, INSERT, UPDATE
ON clearcare.alert_events, clearcare.alert_notifications
TO clearcare_pipeline;

GRANT USAGE
ON SEQUENCE clearcare.alert_events_id_seq, clearcare.alert_notifications_id_seq
TO clearcare_pipeline;
