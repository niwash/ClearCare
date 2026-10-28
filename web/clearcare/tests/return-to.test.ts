import { describe, expect, test } from "vitest";

import { DEFAULT_RETURN_TO, safeReturnPath } from "@/lib/return-to";

describe("return paths", () => {
  test("an internal path is kept", () => {
    expect(safeReturnPath("/search")).toBe("/search");
    expect(safeReturnPath("/centres/738")).toBe("/centres/738");
  });

  test("query and fragment are kept", () => {
    expect(safeReturnPath("/search?county=Dublin&page=2")).toBe(
      "/search?county=Dublin&page=2",
    );
    expect(safeReturnPath("/national#re-assessment")).toBe(
      "/national#re-assessment",
    );
  });

  test("a missing or empty value falls back home", () => {
    expect(safeReturnPath(undefined)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnPath(null)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnPath("")).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnPath("   ")).toBe(DEFAULT_RETURN_TO);
  });

  test("external and protocol-relative urls are refused", () => {
    expect(safeReturnPath("https://evil.example")).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnPath("//evil.example")).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnPath("///evil.example")).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnPath("javascript:alert(1)")).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnPath("/\\evil.example")).toBe(DEFAULT_RETURN_TO);
  });

  test("control characters are refused", () => {
    expect(safeReturnPath("/search\nSet-Cookie: x=1")).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnPath("/search\r\nLocation: //evil.example")).toBe(
      DEFAULT_RETURN_TO,
    );
    expect(safeReturnPath("/search\u0000")).toBe(DEFAULT_RETURN_TO);
  });

  test("authentication routes are refused", () => {
    expect(safeReturnPath("/api/auth/callback/cognito")).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnPath("/api/auth/signin")).toBe(DEFAULT_RETURN_TO);
  });
});
