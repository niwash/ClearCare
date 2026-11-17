# Deleting an account

An account is an entry in the Cognito pool, and the database holds two things for it: a row in
`clearcare.users`, which is the pool's subject claim and a number the site files things against, and
the saved search that row owns in `clearcare.user_preferences`. Nothing else is kept: no name, no
address, no history, and the words typed into the search boxes are not stored. Deleting an account
means deleting all three, in the order below.

The order matters. The subject claim is the only thing that connects those rows to an address, and it
is read from the pool: delete the pool entry first and what is left in the database is a value nobody
can match to a person any more.

## What a request looks like

A visitor writes to the contact address asking for their account and email address to be removed.
Nothing in the site can do this for them, and nothing should: an account must not be deletable by
whoever holds the browser.

## Handling it

1. Check the request comes from the account's own address. If it does not, reply asking for a
   message from that address, and do nothing until it arrives.
2. Read the account's subject claim from the pool:

   ```sh
   aws cognito-idp admin-get-user \
       --user-pool-id "$(terraform -chdir=infra/aws/cognito/production output -raw user_pool_id)" \
       --username someone@example.com \
       --query 'UserAttributes[?Name==`sub`].Value' --output text
   ```
3. Delete the account's rows, connected as a login that may write them — the migrator's, whose
   password is in `clearcare/database/migrator`. The API's login cannot delete here, deliberately, so
   the owner is the role to act as:

   ```sql
   SET ROLE clearcare_owner;
   DELETE FROM clearcare.users WHERE cognito_sub = 'the-sub-from-step-2';
   ```

   The saved search goes with it: `clearcare.user_preferences.user_id` references `users.id` with
   `ON DELETE CASCADE`. A visitor who used "Forget my preferences" has no saved search left but still
   has a `users` row, so this step is needed either way.
4. Delete the user, from the console (User pools → the pool → Users → Delete user) or:

   ```sh
   aws cognito-idp admin-delete-user \
       --user-pool-id "$(terraform -chdir=infra/aws/cognito/production output -raw user_pool_id)" \
       --username someone@example.com
   ```

5. Reply once it is done. Say that the account is closed, its address removed from the pool and the
   search kept for it deleted, and that any page they had open may keep working until they close it.
6. Note the date of the request in the operations log. The address is not written down: it is what
   the request asked to remove. CloudTrail keeps the API call for 90 days; nothing in ClearCare
   keeps a list of deleted accounts.

## What is not covered yet

There is no self-service deletion and no deletion queue. Requests are handled by hand — the two rows
above included — which is appropriate while the number of accounts is small and is the first thing to
automate if it grows. A route that did it would have to delete the same rows in the same order, as
ADR-0025 records.

## Sign-up abuse

Three things are watched, by hand, while accounts are new. The pool reports counts, not addresses, so
the third one needs a look at the user list rather than a chart.

- **Volume.** The pool publishes `SignUpSuccesses` and `SignUpThrottles` to CloudWatch, per user pool.
  A spike in sign-ups, or throttles that mean something is retrying hard, is the signal. There is no
  breakdown by address or address range.
- **Reputation and cost.** SES publishes `Bounce`, `Complaint` and `Reputation.BounceRate` per
  identity on the sending domain; a complaint rate above 0.1% puts deliverability at risk, because
  verification mail is what a new visitor waits for. Pause sign-ups (below) and investigate.
- **The user list itself.** `aws cognito-idp list-users` shows the addresses. A run of near-identical
  addresses, or accounts created in the same minute, is the pattern a count cannot show.

To stop new accounts without taking the pool down, set
`admin_create_user_config.allow_admin_create_user_only = true` in the module and apply: existing
accounts keep working, and nobody can sign up. To stop a single address, disable that user with
`aws cognito-idp admin-disable-user`. Rolling back the whole feature is in `rollback.md`.

A real abuse control — rate limiting per address, a disposable-address check, and an alarm on the
sign-up metric — is still to be built. Until it is, the launch gate on abuse readiness is met by
watching the three signals above, not by an automated control.
