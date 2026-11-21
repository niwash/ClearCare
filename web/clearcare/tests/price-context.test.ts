// tests/price-context.test.ts
// When a home's Overview explains how its weekly price compares with homes of the same kind.
// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";

import { farBelowTypical } from "../lib/price-context.ts";

test("shows the note for a price below half the median", () => {
  assert.equal(farBelowTypical(342, 1964), true);
});

test("leaves the note out at half the median or above", () => {
  assert.equal(farBelowTypical(982, 1964), false);
  assert.equal(farBelowTypical(1193, 1964), false);
});

test("leaves the note out when either price is missing", () => {
  assert.equal(farBelowTypical(null, 1964), false);
  assert.equal(farBelowTypical(undefined, 1964), false);
  assert.equal(farBelowTypical(342, null), false);
  assert.equal(farBelowTypical(342, undefined), false);
});
