# Deleting an account

An account is an entry in the Cognito pool. ClearCare keeps nothing else about a signed-in visitor:
the site stores no profile, no saved searches and no history against the account, and the database
has no table for it. So deleting the pool entry deletes the account.

## What a request looks like

A visitor writes to the contact address asking for their account and email address to be removed.
Nothing in the site can do this for them, and nothing should: an account must not be deletable by
whoever holds the browser.

## Handling it

1. Check the request comes from the account's own address. If it does not, reply asking for a
   message from that address, and do nothing until it arrives.
2. Delete the user, from the console (User pools → the pool → Users → Delete user) or:

   ```sh
   aws cognito-idp admin-delete-user \
       --user-pool-id "$(terraform -chdir=infra/aws/cognito/production output -raw user_pool_id)" \
       --username someone@example.com
   ```

3. Reply once it is done. Say that the address is no longer held, and that any page they had open
   may keep working until they close it.
4. Note the date and the address in the operations log. CloudTrail keeps the API call for 90 days;
   nothing in ClearCare keeps a list of deleted accounts.

## What is not covered yet

There is no self-service deletion and no deletion queue. Requests are handled by hand, which is
appropriate while the number of accounts is small and is the first thing to automate if it grows.

## Sign-up abuse

Two things are watched, by hand, while accounts are new:

- **Volume.** Cognito reports sign-ups and verification sends in CloudWatch. A burst from one
  address range, or many sign-ups that never verify, is the signal. Verification mail costs money
  and can damage the sending domain's reputation, so a burst is acted on rather than watched.
- **Cost and reputation.** SES reports bounces and complaints per identity. A complaint rate above
  0.1% means the sending domain is at risk; pause sign-ups (below) and investigate.

To stop new accounts without taking the pool down, set
`admin_create_user_config.allow_admin_create_user_only = true` in the module and apply: existing
accounts keep working, and nobody can sign up. To stop a single address, disable that user with
`aws cognito-idp admin-disable-user`. Rolling back the whole feature is in `rollback.md`.

A real abuse control — rate limiting per address, a disposable-address check, and an alarm on the
sign-up metric — is still to be built. Until it is, the launch gate on abuse readiness is met by
watching the two signals above, not by an automated control.
