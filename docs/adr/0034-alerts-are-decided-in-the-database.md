# Alerts are decided in the database, not in the email

A visitor can ask to be told when a home they follow is inspected again. This record fixes how that is kept: four tables in `clearcare`, one writer for the visitor's choices, and a pipeline that turns a batch of new reports into one email per person.

The alternative was to compute everything when the mail is sent, from the saved search or the shortlist a visitor already has. That fails in three ways: the shortlist lives in one browser (CCARE-127), so it cannot be mailed; the rule for what counts as news would live in the sender, where it cannot be tested against the data; and a person who subscribed last year would be re-derived from today's state, so nothing records what they asked for.

**The four tables, and why each exists.** `alert_packages` is the catalogue: one row per kind of subscription, with `scope`, `context_schema`, and whether it is active. It is seeded by the migration, not written by anyone at runtime. FACILITY, COUNTY and ALL are active; RADIUS is seeded inactive with `latitude`, `longitude` and `radius_miles`, because the columns and the shape are settled but the feature is not. `alert_subscriptions` is the visitor's choice: `user_id`, `alert_package_id`, `context` and `metadata` as JSONB, `is_active` and `deactivated_at`. `alert_events` is what the pipeline noticed; `alert_notifications` is what was sent, with `status`, `context`, `metadata` and `sent_at`.

**The API is the only writer of a subscription.** The website talks to the API, as it does for saved searches, and the API upserts `clearcare.users` by `cognito_sub` (ADR-0010 keeps identity in Cognito and this table holds only what the site writes). The pipeline reads subscriptions and never writes them, so a bug in the ingest cannot silence a person's alerts.

**Counties are ids, not names.** The COUNTY package's `context` holds `county_id`, an integer naming a row in `clearcare.county` (CCARE-90, V25). The same twenty-six names already appear three times: the register as HIQA printed it, the site's `lib/counties.ts` and the API's enum. A subscription that stored the name would silently stop matching when one of those spellings changed; an id cannot drift, and `GET /alerts` joins the name back for display.

**One event per scope value per ingest batch, and no `report_id` column.** A batch that brings twelve reports for Dublin writes one COUNTY event for Dublin, one ALL event, and one FACILITY event per home, with the report ids in `metadata`. The resolver then matches an event to a subscription with `event.context @> subscription.context`, a containment test that works the same whether the event names one home, one county or everything. A `report_id` column would mean one event per report, twelve rows instead of two, and the containment check would no longer describe the batch.

**One email per person per batch, attributed to the closest scope.** When a person subscribes to a home, its county and everything, the same report matches all three. The resolver keeps the report once, attributed FACILITY, so the email says why they are being told rather than repeating the same inspection three times. The order is FACILITY, COUNTY, RADIUS, ALL.

**Subscriptions are deactivated, never deleted.** The natural key `(user_id, alert_package_id, context)` with `ON CONFLICT ... SET is_active = TRUE` makes subscribing twice the same row and re-subscribing the old one, so the notification history under it stays readable. `deactivated_at` records when it stopped.

**No email address is stored.** `clearcare.users` has `cognito_sub` and nothing else, and this record does not add an email column: the dispatcher asks Cognito for the address with `AdminGetUser` when it sends, caches it for that run, and skips an account with no verified address. One copy of the address, and the deletion in the runbook removes both.

**The unsubscribe link needs no session.** It carries the user id and an HMAC of it, signed with `ALERTS_LINK_SECRET`, and the API verifies it and deactivates every active subscription for that person. A GET only renders a confirmation page and changes nothing, because a mail scanner that follows links would otherwise unsubscribe people; the POST does the work. The secret is shared by the API and the pipeline and nothing else.

**Seeds are guarded by id.** Subscriptions reference `alert_packages`, so a later migration that renames or reorders the seeds must keep the ids, or it would repoint existing subscriptions at a different scope.

**Grants follow ADR-0010.** `clearcare_api` gets SELECT on `alert_packages` and `clearcare.county`, SELECT, INSERT and UPDATE on `alert_subscriptions`, and the sequences it needs; it never touches events or notifications. `clearcare_pipeline` gets SELECT on `alert_packages`, `alert_subscriptions`, `users` and `clearcare.county`, SELECT, INSERT and UPDATE on `alert_events` and `alert_notifications`, and the sequences those two use. No role called `clearcare_web` exists.

The privacy notice changes in the same pull request (ADR-0028): the address read from Cognito at send time and not stored, the subscriptions, the notification history, and how to stop it.

This is V26. Its header cites this record, as V25's cites CCARE-90.
