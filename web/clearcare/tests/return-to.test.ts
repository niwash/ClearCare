// tests/return-to.test.ts
// The return path a sign-in may send a visitor back to. It is the one thing here
// that touches a URL a stranger can write, so every refusal is tested. Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DEFAULT_RETURN_TO, safeReturnPath } from "../lib/return-to.ts";

describe("return paths", () => {
  test("an internal path is kept", () => {
    assert.equal(safeReturnPath("/search"), "/search");
    assert.equal(safeReturnPath("/centres/738"), "/centres/738");
  });

  test("query and fragment are kept", () => {
    assert.equal(
      safeReturnPath("/search?county=Dublin&page=2"),
      "/search?county=Dublin&page=2",
    );
    assert.equal(safeReturnPath("/national#re-assessment"), "/national#re-assessment");
  });

  test("a missing or empty value falls back home", () => {
    assert.equal(safeReturnPath(undefined), DEFAULT_RETURN_TO);
    assert.equal(safeReturnPath(null), DEFAULT_RETURN_TO);
    assert.equal(safeReturnPath(""), DEFAULT_RETURN_TO);
    assert.equal(safeReturnPath("   "), DEFAULT_RETURN_TO);
  });

  test("external and protocol-relative urls are refused", () => {
    assert.equal(safeReturnPath("https://evil.example"), DEFAULT_RETURN_TO);
    assert.equal(safeReturnPath("//evil.example"), DEFAULT_RETURN_TO);
    assert.equal(safeReturnPath("///evil.example"), DEFAULT_RETURN_TO);
    assert.equal(safeReturnPath("javascript:alert(1)"), DEFAULT_RETURN_TO);
    assert.equal(safeReturnPath("/\\evil.example"), DEFAULT_RETURN_TO);
  });

  test("control characters are refused", () => {
    assert.equal(safeReturnPath("/search\nSet-Cookie: x=1"), DEFAULT_RETURN_TO);
    assert.equal(
      safeReturnPath("/search\r\nLocation: //evil.example"),
      DEFAULT_RETURN_TO,
    );
    assert.equal(safeReturnPath("/search\u0000"), DEFAULT_RETURN_TO);
  });

  test("authentication routes are refused", () => {
    assert.equal(
      safeReturnPath("/api/auth/callback/cognito"),
      DEFAULT_RETURN_TO,
    );
    assert.equal(safeReturnPath("/api/auth/signin"), DEFAULT_RETURN_TO);
  });
});
