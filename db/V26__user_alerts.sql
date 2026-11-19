-- Email alerts for newly published inspection reports (CCARE-264). Flyway
-- runs this as clearcare_owner (ADR-0010); the roles it grants to are created
-- by infra/postgres/roles.sql.
--
-- Schema only, by design: nothing is seeded here. The three generic packages
-- are inserted and activated by a separate task; until then the foreign keys
-- keep alert_subscriptions and alert_events empty by construction, so the
-- feature ships inert.
--
-- The recipient's email address is never stored. Cognito owns the account and
-- its address (V15: the subject claim is the only identity stored); the
-- dispatcher resolves the address from Cognito at send time, keyed by the
-- cognito_sub this schema already holds.

-- What an account can subscribe to. Generic kinds for now -- one row per
-- scope (centre, county, all) -- with the copy the site shows. A row only
-- becomes subscribable when the seeding task sets is_active; the default is
-- false so nothing is live by accident.
CREATE TABLE clearcare.alert_packages (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title text NOT NULL UNIQUE CHECK (title <> ''),
    description text,
    scope text NOT NULL UNIQUE CHECK (scope IN ('CENTRE', 'COUNTY', 'ALL')),
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- What one account wants emailed about: a package plus the target inside it,
-- one row per target. The metadata array holds exactly one object, so a user
-- who follows Cavan and Dublin has two rows, not one row with two counties.
CREATE TABLE clearcare.alert_subscriptions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES clearcare.users (id) ON DELETE CASCADE,
    alert_package_id integer NOT NULL REFERENCES clearcare.alert_packages (id),
    -- Exactly one element, and it must be an object: '[{"county_id": 1}]',
    -- '[{"centre_id": "117"}]', or '[]' for the all-reports package.
    -- jsonb_array_length keeps a multi-target array out; jsonb_typeof keeps
    -- bare strings and nested arrays out. The keys inside the object are the
    -- API's to sanitize before insert.
    metadata jsonb NOT NULL CHECK (
        jsonb_typeof(metadata) = 'array'
        AND jsonb_array_length(metadata) <= 1
        AND (metadata = '[]' OR jsonb_typeof(metadata -> 0) = 'object')
    ),
    is_active boolean NOT NULL DEFAULT true,
    -- Unsubscribe deletes rows rather than flagging them; the column is the
    -- escape hatch for other deactivation paths, and the check keeps the two
    -- from disagreeing.
    deactivated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((is_active) = (deactivated_at IS NULL))
);

-- One ACTIVE subscription per (account, package, target): a double click or a
-- retried request cannot create the row twice, while Cavan and Dublin sit
-- side by side because their metadata differs. jsonb normalizes whitespace
-- and object-key order, so two identical writes compare equal; the partial
-- WHERE keeps the comparison among live rows only.
CREATE UNIQUE INDEX alert_subscriptions_active_key
    ON clearcare.alert_subscriptions (user_id, alert_package_id, metadata)
    WHERE is_active;

-- The ingest workflow's receipt of a run. It generates one task_uuid per run
-- and stamps every event it writes with it -- one row per package the run
-- matched, with the reports that matched in metadata. The dispatcher later
-- groups by (package, task_uuid), whether it sends one email per package or
-- one per run.
--
-- Status lifecycle: pending (ingest wrote it) -> processing (a dispatcher run
-- claims it; the crash marker, requeued to pending) -> processed (with
-- processed_at) or failed (retriable; attempt history lives in the
-- pipeline_run ledger). No 'skipped': matching nobody is a processed outcome,
-- and per-account skips live on alert_notifications.
CREATE TABLE clearcare.alert_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alert_package_id integer NOT NULL REFERENCES clearcare.alert_packages (id),
    task_uuid uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
    metadata jsonb NOT NULL CHECK (jsonb_typeof(metadata) = 'array'),
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    UNIQUE (alert_package_id, task_uuid),
    CHECK ((status = 'processed') = (processed_at IS NOT NULL))
);

-- The dispatcher's scan of events it has not handled yet; a partial index
-- keeps it cheap as processed history grows.
CREATE INDEX alert_events_unprocessed
    ON clearcare.alert_events (created_at)
    WHERE processed_at IS NULL;

-- The dispatcher's per-account receipt: what one account was told about one
-- ingest run. Deliberately no unique constraint: how many receipts a run
-- writes for an account, and whether the send is one email or several, is
-- the dispatcher's decision at runtime, so the table stays generic for
-- sources beyond report ingestion. Deduping belongs to that workflow.
-- retry_count carries a failed send to the next attempt on the same row.
CREATE TABLE clearcare.alert_notifications (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES clearcare.users (id) ON DELETE CASCADE,
    task_uuid uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
    metadata jsonb NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
    retry_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz
);

-- The dispatcher's retry scan: the rows it still owes an email.
CREATE INDEX alert_notifications_unsent
    ON clearcare.alert_notifications (created_at)
    WHERE status IN ('pending', 'failed');

-- One capability per account: the secret a signed-out email link presents
-- instead of a session. Random, so it cannot be derived from the id or the
-- subject claim, and it is not personal data -- the no-email boundary of V15
-- stays intact. The dispatcher creates the row the first time it composes an
-- email for the account (INSERT ... ON CONFLICT DO NOTHING); the site's
-- unsubscribe endpoint looks the account up by token and deletes its
-- subscription rows.
CREATE TABLE clearcare.alert_unsubscribe (
    user_id bigint PRIMARY KEY REFERENCES clearcare.users (id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- The site keeps subscriptions like its user_preferences rows, and cancels
-- them by DELETE now that unsubscribe deletes. It reads packages for display
-- and the token table for the unsubscribe endpoint.
GRANT SELECT, INSERT, UPDATE, DELETE
ON clearcare.alert_subscriptions
TO clearcare_api;
GRANT USAGE ON SEQUENCE clearcare.alert_subscriptions_id_seq TO clearcare_api;

GRANT SELECT ON clearcare.alert_packages TO clearcare_api;
GRANT SELECT ON clearcare.alert_unsubscribe TO clearcare_api;

-- The pipeline does the rest of the work: the ingest workflow resolves
-- packages and writes events, and the dispatcher reads events and
-- subscriptions, reads accounts for cognito_sub only, writes notifications,
-- and creates the unsubscribe capability the first time it emails an account.
GRANT SELECT ON clearcare.alert_packages TO clearcare_pipeline;
GRANT SELECT ON clearcare.alert_subscriptions TO clearcare_pipeline;

-- Accounts: the dispatcher resolves each address from Cognito by cognito_sub,
-- so it reads only those two columns (V15 keeps the table's full grants with
-- the API).
GRANT SELECT (id, cognito_sub) ON clearcare.users TO clearcare_pipeline;

GRANT SELECT, INSERT, UPDATE
ON clearcare.alert_events
TO clearcare_pipeline;
GRANT USAGE ON SEQUENCE clearcare.alert_events_id_seq TO clearcare_pipeline;

GRANT SELECT, INSERT, UPDATE
ON clearcare.alert_notifications
TO clearcare_pipeline;
GRANT USAGE ON SEQUENCE clearcare.alert_notifications_id_seq TO clearcare_pipeline;

GRANT SELECT, INSERT
ON clearcare.alert_unsubscribe
TO clearcare_pipeline;
