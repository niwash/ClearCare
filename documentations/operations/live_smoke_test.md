# Smoke test before public accounts go live

Run this against the production pool before the site is announced, and again after any change to
the pool, the app client or the sending domain. It takes about ten minutes.

## 1. The pool exists and answers

```sh
cd infra/aws/cognito/production
terraform init -backend-config="bucket=clearcare-terraform-state-$ACCOUNT_ID"
terraform apply
terraform output            # issuer, domain, client_id, client_secret, callback_urls
```

Check the issuer serves a discovery document. Cognito publishes it on the pool, not on the login
domain:

```sh
curl -s -o /dev/null -w '%{http_code}\n' "$(terraform output -raw issuer)/.well-known/openid-configuration"
```

Expect `200`.

## 2. Mail can leave the domain

`terraform output ses_dkim_tokens` gives three CNAME records. They have to be published in DNS and
verified in SES (Identities → the domain → Verified) before Cognito can send through it. The
production account also has to be out of the SES sandbox, or mail only reaches verified addresses.

## 3. The site is pointed at the pool

The site reads five variables, of which three come straight from the pool's output and two from
Secrets Manager: `AUTH_COGNITO_ISSUER`, `AUTH_COGNITO_ID`, `COGNITO_DOMAIN`, `AUTH_COGNITO_SECRET`
and `AUTH_SECRET`. In `infra/aws/live` they are `cognito_issuer`, `cognito_client_id`,
`cognito_domain`, plus the two secrets, switched on together with `accounts_enabled = true`.
The task also sets `AUTH_URL` to `https://<site_hostname>`: behind the load balancer the server would
otherwise build Cognito's callback and logout URLs from the container's own address.

With any of them missing the account controls disappear and the authentication routes answer 503, so
an empty header is the symptom of a missing variable rather than a broken pool. That is also why the
site can be deployed before the pool exists.

## 4. The four journeys, in a browser

| Journey | Expected |
| --- | --- |
| Create account with a new address | Cognito's sign-up page, then the verification mail, then back on the page the visitor started from, signed in |
| Log in with the same account | Straight to Cognito's sign-in page, no page of ours in between, then back signed in |
| Log out | The Log out button posts to the server action, which clears the ClearCare cookie and then leaves for Cognito's logout, landing on the start page with Log in and Create account showing |
| Log in again after logging out | Credentials asked for again — a hosted session left alive shows up here |

Check the cookie after signing in: `authjs.session-token` is `HttpOnly`, `Secure` on https, and the
browser's own JavaScript cannot read it.

## 5. Nothing else moved

```sh
cd web/clearcare
npm ci
npm test
npm run build
```

`/privacy`, `/contacts`, `/resources` and the guides still build as static pages.
