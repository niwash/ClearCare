// tests/auth.test.ts
// The behaviour of the auth helpers that a page relies on: what counts as a
// configured environment, what a page may see of the session, and the answer an
// account route gives while the variables are missing. Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  authConfigured,
  authUnavailable,
  missingAuthVariables,
  projectSession,
} from "../lib/auth-config.ts";

const completeEnv = {
  AUTH_SECRET: "test-secret",
  AUTH_COGNITO_ID: "test-client-id",
  AUTH_COGNITO_SECRET: "test-client-secret",
  AUTH_COGNITO_ISSUER:
    "https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_test",
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
  test("projection keeps display fields", () => {
    const projected = projectSession(session, {
      sub: "02c5c474-5051-7081-4a57-3a5bc3dacbd1",
      name: "Sawin Rya",
      email: "sawin@example.com",
      picture: "https://example.com/avatar.png",
    });

    assert.equal(projected.user.email, "sawin@example.com");
    assert.equal(projected.user.name, "Sawin Rya");
    assert.equal(projected.user.sub, "02c5c474-5051-7081-4a57-3a5bc3dacbd1");
    assert.equal(projected.expires, session.expires);
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
