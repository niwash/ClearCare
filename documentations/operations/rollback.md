# Rolling back public accounts

Accounts are additive: the site works without them, and the quickest rollback is to stop advertising
them rather than to delete anything.

## 1. Take the controls away (seconds)

Remove `AUTH_COGNITO_ID`, `AUTH_COGNITO_SECRET`, `AUTH_COGNITO_ISSUER` or `COGNITO_DOMAIN` from the
running environment and redeploy. The account controls disappear from every page, `/api/auth/*` and
`/sign-out` answer 503, and the rest of the site is unchanged. Existing sessions stop being readable,
so nobody is signed in any more.

## 2. Stop new accounts (a minute)

Set `admin_create_user_config.allow_admin_create_user_only = true` in `modules/cognito` and apply.
Existing accounts keep working and nobody can sign up. This is the right move for an abuse spike,
because it leaves sign-in alone.

## 3. Stop mail (a minute)

Remove `ses_source_arn` and `from_email_address` from the production root and apply: Cognito falls
back to its own sender, capped at 50 emails a day. Use this if the sending domain's reputation is at
risk — complaints or bounces — because the cap throttles the damage while DNS and SES are fixed.

## 4. Remove the pool (last resort)

Deleting the pool deletes every account and cannot be undone, so it needs a decision, not just a
command. Set `deletion_protection = "INACTIVE"` in the module, apply, then `terraform destroy` from
`infra/aws/cognito/production`.

Before destroying, export the user list if anyone may need to be told:

```sh
aws cognito-idp list-users --user-pool-id "$(terraform output -raw user_pool_id)" \
    --query 'Users[].[Username,UserStatus,UserCreateDate]' --output table
```

## What a rollback does not fix

The site's own sessions are cookies with a seven-day idle limit; taking the variables away makes
them unreadable, which signs everyone out. Cognito's hosted session is separate and survives until it
expires or the visitor logs out, so a rollback is not a way to end hosted sessions in a hurry.
