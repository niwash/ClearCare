// tests/auth.test.ts
// The behaviour the auth helpers give a page: what counts as a configured
// environment, which account a session belongs to, what a page may see of it,
// and the answer an account route gives while the variables are missing.
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  authConfigured,
  authUnavailable,
  missingAuthVariables,
  pinSubject,
  projectSession,
} from "../lib/auth-config.ts";

const completeEnv = {
  AUTH_SECRET: "test-secret",
  AUTH_COGNITO_ID: "test-client-id",
  AUTH_COGNITO_SECRET: "test-client-secret",
  AUTH_COGNITO_ISSUER:
    "https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_test",
  COGNITO_DOMAIN:
    "https://clearcare-dev-test.auth.eu-north-1.amazoncognito.com",
};

const session = {
  expires: "2026-11-03T00:00:00.000Z",
  user: { name: "Sawin Rya", email: "sawin@example.com" },
};

describe("auth environment", () => {
  test("missing variables are named", () => {
    assert.deepEqual(missingAuthVariables({}), [
      "AUTH_SECRET",
      "AUTH_COGNITO_ID",
      "AUTH_COGNITO_SECRET",
      "AUTH_COGNITO_ISSUER",
      "COGNITO_DOMAIN",
    ]);
  });

  test("blank values count as missing", () => {
    assert.deepEqual(
      missingAuthVariables({ ...completeEnv, AUTH_SECRET: "   " }),
      ["AUTH_SECRET"],
    );
  });

  test("complete environment is configured", () => {
    assert.equal(authConfigured(completeEnv), true);
    assert.equal(authConfigured({}), false);
  });
});

describe("session", () => {
  test("a page sees the display fields and nothing else", () => {
    const projected = projectSession(session, {
      sub: "02c5c474-5051-7081-4a57-3a5bc3dacbd1",
      name: "Sawin Rya",
      email: "sawin@example.com",
      picture: "https://example.com/avatar.png",
      access_token: "provider-access-token",
      id_token: "provider-id-token",
      refresh_token: "provider-refresh-token",
    });

    // The whole object, so a field that starts leaking fails here.
    assert.deepEqual(projected, {
      expires: session.expires,
      user: {
        email: "sawin@example.com",
        name: "Sawin Rya",
        sub: "02c5c474-5051-7081-4a57-3a5bc3dacbd1",
      },
    });
  });
});

describe("subject", () => {
  const account = { providerAccountId: "3f1a9b8e-0f21-4d6c-9a55-2b0f9c7d1e44" };

  test("sign-in replaces the id next-auth invented with Cognito's subject", () => {
    const token = pinSubject(
      { sub: "d4a1f9c2-random-uuid", email: "sawin@example.com" },
      account,
      { sub: "3f1a9b8e-0f21-4d6c-9a55-2b0f9c7d1e44" },
    );

    assert.equal(token.sub, "3f1a9b8e-0f21-4d6c-9a55-2b0f9c7d1e44");
  });

  test("the account id is the fallback when the profile has no subject", () => {
    const token = pinSubject({}, account, {});
    assert.equal(token.sub, account.providerAccountId);
  });

  test("a later read keeps the subject it was given", () => {
    const token = { sub: "3f1a9b8e-0f21-4d6c-9a55-2b0f9c7d1e44" };

    pinSubject(token, null, { sub: "someone-elses-subject" });

    assert.equal(token.sub, "3f1a9b8e-0f21-4d6c-9a55-2b0f9c7d1e44");
  });
});

describe("unconfigured environment", () => {
  test("account route answers 503", async () => {
    const response = authUnavailable();

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "auth_not_configured",
      message: "Sign-in is not configured on this site.",
    });
  });
});
