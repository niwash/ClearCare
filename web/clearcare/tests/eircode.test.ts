// tests/eircode.test.ts
// Reading an Eircode from what was typed into a search box (CCARE-224): compact and upper case,
// with a letter O read as 0, or null for anything else.
// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";

import { asEircode } from "../lib/eircode.ts";

test("a full Eircode comes back without its space, in upper case", () => {
  assert.equal(asEircode("w23 p6ex"), "W23P6EX");
});

test("a routing key is an Eircode too", () => {
  assert.equal(asEircode("D6W"), "D6W");
});

test("a letter O is read as 0", () => {
  assert.equal(asEircode("w23 p6ox"), "W23P60X");
  assert.equal(asEircode("DO6"), "D06");
});

test("a place name is not an Eircode, even one that would read as one with its Os as 0", () => {
  assert.equal(asEircode("Doonane"), null);
  assert.equal(asEircode("Doonan 1"), null);
  assert.equal(asEircode("Elm Hall"), null);
});
