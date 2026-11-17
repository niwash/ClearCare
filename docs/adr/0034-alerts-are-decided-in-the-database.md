# Alerts are decided in the database, not in the email

A visitor will be able to ask to be told when a home they follow is inspected again. This record fixes the part that is settled: four tables in `clearcare`, one writer for the visitor's choices, and a pipeline that will turn a batch of new reports into one email per person. The tables are created empty; the package catalogue and the runtime data are added when the dispatcher is built.

The alternative was to compute everything when the mail is sent, from the saved search or the shortlist a visitor already has. That fails in three ways: the shortlist lives in one browser (CCARE-127), so it cannot be mailed; the rule for what counts as news would live in the sender, where it cannot be tested against the data; and a person who subscribed last year would be re-derived from today's state, so nothing records what they asked for.

**The four tables, and why each exists.** `alert_packages` is the catalogue: one row per kind of subscription, with `scope` and whether it is active. V26 creates it with no rows; a later migration seeds FACILITY, COUNTY and ALL, and RADIUS when the feature is built, all inactive until the dispatcher can serve them. `is_active` defaults false, so a package added without an explicit state is not offered. `alert_subscriptions` is the visitor's choice: `user_id`, `alert_package_id`, `metadata`, `is_active` and `deactivated_at`. `alert_events` is what the pipeline noticed: the package, a status and `metadata`; `alert_notifications` is what was sent: the account, a status, `metadata` and `sent_at`.

**No context yet.** The per-scope arguments (a home, a county, a point) were `context` and `context_schema` in the first draft. They are removed: the tables are created without them, no rows are seeded, and the columns return in a later migration with the resolver and the dispatcher, when their shape is known. A context nothing can match would only collect subscriptions that never fire. `metadata` remains the flexible document for what the API or the pipeline needs to keep alongside a row.

**The API is the only writer of a subscription.** The website talks to the API, as it does for saved searches, and the API upserts `clearcare.users` by `cognito_sub` (ADR-0010 keeps identity in Cognito and this table holds only what the site writes). The pipeline reads subscriptions and never writes them, so a bug in the ingest cannot silence a person's alerts. The current alert routes are being reworked to these tables; nothing is offered until the packages are active.

**Counties are ids, not names.** `clearcare.county` (CCARE-90, V25) remains and the API keeps SELECT on it. The COUNTY package has no context to name a county yet; the ids will be used when the per-county subscription is modelled.

**One event per package per batch, and no `report_id` column.** A batch that brings twelve reports writes one event per package, with the report ids in `metadata`. There is no context to match on yet; that is the resolver's job when it is built. A `report_id` column would mean one event per report, twelve rows instead of one, and a row that describes a report rather than the batch that noticed it.

**One email per person per batch.** The digest and the attribution rule (FACILITY before COUNTY before RADIUS before ALL) belong to the dispatcher, and are recorded here for when it is built; they are not in V26.

**Subscriptions are deactivated, never deleted.** The natural key is `(user_id, alert_package_id)` while a subscription is an account and a package; the subject columns will extend it when they land. `ON CONFLICT ... SET is_active = TRUE` makes subscribing twice the same row and re-subscribing the old one, so the notification history under it stays readable. `deactivated_at` records when it stopped.

**No email address is stored.** `clearcare.users` has `cognito_sub` and nothing else, and this record does not add an email column: the dispatcher asks Cognito for the address with `AdminGetUser` when it sends, caches it for that run, and skips an account with no verified address. One copy of the address, and the deletion in the runbook removes both.

**The unsubscribe link needs no session.** It carries the user id and an HMAC of it, signed with `ALERTS_LINK_SECRET`, and the API verifies it and deactivates every active subscription for that person. A GET only renders a confirmation page and changes nothing, because a mail scanner that follows links would otherwise unsubscribe people; the POST does the work. The secret is shared by the API and the pipeline and nothing else.

**No seeds in V26.** The package rows are added by a later migration, all inactive; their ids are stable for the subscriptions that reference them.

**Grants follow ADR-0010.** `clearcare_api` gets SELECT on `alert_packages` and `clearcare.county`, SELECT, INSERT and UPDATE on `alert_subscriptions`, and the sequences it needs; it never touches events or notifications. `clearcare_pipeline` gets SELECT on `alert_packages`, `alert_subscriptions`, `users` and `clearcare.county`, SELECT, INSERT and UPDATE on `alert_events` and `alert_notifications`, and the sequences those two use. No role called `clearcare_web` exists.

The privacy notice changes in the same pull request (ADR-0028): the address read from Cognito at send time and not stored, the subscriptions, the notification history, and how to stop it.

This is V26. Its header cites this record, as V25's cites CCARE-90.
