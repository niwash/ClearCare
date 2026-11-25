// tests/last-checked.test.ts
// The day a page's facts were last checked (lib/last-checked.ts, CCARE-310). A page keeps the day
// once, as an ISO date; the words a reader sees are made from it, so the two can't disagree.
// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";

import { lastCheckedLabel } from "../lib/last-checked.ts";

test("writes the day out in full, as Support Services always has", () => {
  assert.equal(lastCheckedLabel("2026-11-13"), "13 November 2026");
});

test("writes a single-figure day without a leading zero, and September in full", () => {
  assert.equal(lastCheckedLabel("2026-09-05"), "5 September 2026");
});
