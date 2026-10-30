// tests/request-origin.test.ts
// The origin a URL is built from has to be the one the browser used. Behind the load balancer the
// server's own address is the container's, which is why the forwarded headers decide.
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { cognitoLogoutUrl } from "../lib/cognito-logout.ts";
import { originFrom } from "../lib/request-origin.ts";

describe("public origin", () => {
  test("the forwarded host and scheme win over the server's own address", () => {
    assert.equal(
      originFrom({
        "x-forwarded-host": "clearcare.ie",
        "x-forwarded-proto": "https",
        host: "0.0.0.0:3000",
      }),
      "https://clearcare.ie",
    );
  });

  test("the first value is used when a proxy appends its own", () => {
    assert.equal(
      originFrom({
        "x-forwarded-host": "clearcare.ie, internal.elb.amazonaws.com",
        "x-forwarded-proto": "https, http",
      }),
      "https://clearcare.ie",
    );
  });

  test("Host is the fallback, and a public host implies https", () => {
    assert.equal(originFrom({ host: "clearcare.ie" }), "https://clearcare.ie");
  });

  test("localhost stays on http so local sign-in keeps working", () => {
    assert.equal(originFrom({ host: "localhost:3000" }), "http://localhost:3000");
    assert.equal(originFrom({ host: "127.0.0.1:3000" }), "http://127.0.0.1:3000");
  });

  test("no headers at all falls back to the development address", () => {
    assert.equal(originFrom({}), "http://localhost:3000");
  });
});

describe("the logout URI Cognito has to match", () => {
  const env = {
    AUTH_COGNITO_ID: "client-123",
    COGNITO_DOMAIN: "https://clearcare.auth.eu-north-1.amazoncognito.com",
  };

  test("is the public origin, not the container's address", () => {
    // The standalone server answers 0.0.0.0:3000 for its own address, which used to become
    // logout_uri and made Cognito answer redirect_mismatch instead of signing out.
    const origin = originFrom({
      "x-forwarded-host": "clearcare.ie",
      "x-forwarded-proto": "https",
      host: "0.0.0.0:3000",
    });
    const url = new URL(cognitoLogoutUrl(env, origin) ?? "");

    assert.equal(url.searchParams.get("logout_uri"), "https://clearcare.ie/");
    assert.equal(origin, "https://clearcare.ie");
  });
});
