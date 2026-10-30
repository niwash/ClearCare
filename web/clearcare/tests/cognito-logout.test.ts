// tests/cognito-logout.test.ts
// Signing out has to end Cognito's hosted session too, or the next sign-in silently reuses it. The
// URL is built from configuration only, and the return URI is the one the app client registers.
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { cognitoLogoutUrl } from "../lib/cognito-logout.ts";

const env = {
  AUTH_SECRET: "test-secret",
  AUTH_COGNITO_ID: "client-123",
  AUTH_COGNITO_SECRET: "test-client-secret",
  AUTH_COGNITO_ISSUER: "https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_test",
  COGNITO_DOMAIN: "https://clearcare-dev-test.auth.eu-north-1.amazoncognito.com",
};

const origin = "https://clearcare.example.com";

describe("hosted logout url", () => {
  test("names the client and the registered uri", () => {
    const url = new URL(cognitoLogoutUrl(env, origin) ?? "");

    assert.equal(
      url.origin,
      "https://clearcare-dev-test.auth.eu-north-1.amazoncognito.com",
    );
    assert.equal(url.pathname, "/logout");
    assert.equal(url.searchParams.get("client_id"), "client-123");
    assert.equal(url.searchParams.get("logout_uri"), `${origin}/`);
  });

  test("the return uri is the origin root, whatever path the origin carries", () => {
    for (const withPath of [`${origin}/`, `${origin}/search?county=Dublin`]) {
      const url = new URL(cognitoLogoutUrl(env, withPath) ?? "");
      assert.equal(url.searchParams.get("logout_uri"), `${origin}/`);
    }
  });

  test("missing or unusable configuration yields no hosted logout", () => {
    assert.equal(cognitoLogoutUrl({}, origin), null);
    assert.equal(cognitoLogoutUrl({ ...env, AUTH_COGNITO_ID: "  " }, origin), null);
    assert.equal(cognitoLogoutUrl({ ...env, COGNITO_DOMAIN: "" }, origin), null);
    assert.equal(cognitoLogoutUrl({ ...env, COGNITO_DOMAIN: "not a url" }, origin), null);
    assert.equal(cognitoLogoutUrl(env, "not a url"), null);
  });
});
