# The dispatcher emails one digest per account, gated and owed by receipts

The dispatcher is a pipeline stage (`send_alerts`) that runs inside the
schedule: once with the startup stages, and as the fourth job, which
downloads nothing because it reads only the database (ADR-0014's
download-less stages). The job's clock is the scheduler's: hourly under
Compose, and in production once a day, where EventBridge starts the
pipeline with `--once` at 06:00 UTC, so a failed send waits a day for its
next attempt and the attempt cap spans days, not hours. A pass requeues
every event some stopped run left
claimed, claims a batch of `pending` and `failed` events as `processing`
(ADR-0034's crash marker, safe to requeue unconditionally because the run
lock means no other dispatcher is claiming), and then depends on one
setting: `CLEARCARE_ALERTS`, the switch the deployed Terraform passes
(CCARE-269). Off, the default, the pass stops there and
marks the claimed events `processed` without receipts, so a deployment
starts inert even with the packages seeded, and the flag doubles as the
kill switch. Open, the pass matches, records and sends.

An event matches a subscription of the same package whose `metadata` the
event's contains, written as jsonb containment so key order and whitespace
do not matter, and only if the subscription already existed when the event
was written: alerts start when you subscribe. That one comparison is also
the backfill guard (the CCARE-266 review's warning): a rebuilt database has
no subscriptions to match, a new subscriber's rows predate no event, and no
global timestamp is needed. What matched is recorded as receipt rows, one
per matched target the account's subscriptions covered (`alert_notifications`,
whose no-unique design ADR-0034 left to this workflow), each metadata a flat
object naming that target, and the all-reports kind a single row per account
per run whose metadata is the empty object, the shape that says the account
follows every report; a receipt row that already says `sent` or `skipped` is
left alone, so a requeued event cannot email the same target twice. The
claimed events are marked `processed` in the same transaction as their
receipts, matching nobody included, and the emails are sent after: a crash
between SES accepting a message and the receipt's `sent` leaves a pending
row that the next pass re-attempts, the one small window where a duplicate
email can happen, preferred over any window where one is lost.

The email is one digest per account per pass, whatever the number of its
receipts, in two parts: an HTML body where each target is clickable text,
and a plain-text fallback where each line spells its address out. The rows
are grouped into sections in memory, in the order the email shows them
("Reports from centres you follow", "Reports from counties you follow",
"New reports across Ireland"), each distinct target named once, the centre
lines linking to the centre's inspections page and the county lines to the
county's filtered search. The all-reports section, whose rows name no
target, is the generic line: new inspection reports have been published
across the site, or have also been published across other areas when the
other sections surround it. An all-reports
digest also carries a "Stay informed" block linking the site-wide search,
since its section links nothing; the footer of every email carries the
reason for the mail and the unsubscribe link, built on the token the pass
creates the first time it composes for the account. The `report_id` the all-reports metadata
deliberately drops (CCARE-266) is beside the point now: the all-reports
receipt records no targets at all, so its section is the generic line
rather than a list of centres. No log line carries an address
(ADR-0034's boundary); the senders log the subject and the plain-text
body, and the pass logs account row ids and message ids.

What actually sends is `CLEARCARE_ALERTS_SENDER`, which this build holds at
`log`, the stand-in that writes the rendered email to the stage's log and
returns a counting fake id, so the whole flow runs with no AWS at all; the
`ses` value and the SESv2 sender behind it are CCARE-268's to land. A
gate that is open without a sender, a
site address (`CLEARCARE_SITE_URL`) or the Cognito pool id
(`CLEARCARE_COGNITO_USER_POOL_ID`) fails the stage before it touches the
database: a misdeclared deployment must not look like a green pass that
emails nothing. Each send is attempted up to three times a pass, with
pauses of thirty seconds and two minutes between, paid out of a shared
ten-minute budget so an outage cannot stretch a pass into hours; a send
that outlives its pass is `failed`, `retry_count` carries the attempts, and
the next pass claims the receipt again. At nine attempts across passes the
receipt becomes `skipped`, the terminal state it also holds for an account
whose address Cognito cannot resolve (an address is asked once per account
per pass, through `AdminGetUser`, and a Cognito that is down fails the
attempt like any other send error). The schema's status vocabulary is
unchanged: `sent`, `skipped` and `failed` on receipts, `processed` on
events.

A digest could have been one email per package, or per event, but the
account reading five county alerts does not want five emails, and the
receipt table's shape (one row per account per ingest run) was designed for
exactly this grouping (ADR-0034). The SES sender sends plain text for now;
the HTML template and the one-click `List-Unsubscribe` headers are
CCARE-268's template work on top of the same call, and the subscribe
endpoints the site needs are CCARE-270's, which owns the
`/alerts/unsubscribe` route the links assume.
