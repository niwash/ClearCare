// tests/page-search.test.ts
// The search as the page address holds it (lib/page-search.ts): what reaches GET /centres, and that
// links from before the one place field search as they did.
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { readSearch } from "../lib/page-search.ts";

describe("links from before", () => {
  test("place, address or eircode alone search as they did", () => {
    assert.deepEqual(readSearch({ place: "Cavan" }).query, { address: "Cavan" });
    assert.deepEqual(readSearch({ place: "a98 c2co" }).query, { eircode: "A98C2C0" });
    assert.deepEqual(readSearch({ address: "Main Street" }).query, { address: "Main Street" });
    assert.deepEqual(readSearch({ eircode: "W23 P6EX" }).query, { eircode: "W23P6EX" });
  });
});
