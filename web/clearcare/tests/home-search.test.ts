// tests/home-search.test.ts
// Where the home page box sends what was typed (CCARE-219): a county to the county filter, an
// Eircode to the place, anything else to the name.
// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";

import { homeSearchHref } from "../lib/home-search.ts";

test("a county's name goes to the county filter, as the API spells it", () => {
  for (const text of ["Cavan", "co cavan"]) {
    assert.equal(homeSearchHref(text), "/search?county=Cavan", text);
  }
});

test("an Eircode goes to the place, with or without its space", () => {
  assert.equal(homeSearchHref("W23 P6EX"), "/search?place=W23+P6EX");
  assert.equal(homeSearchHref("W23P6EX"), "/search?place=W23P6EX");
  assert.equal(homeSearchHref("DO6"), "/search?place=DO6");
});

test("anything else goes to the name", () => {
  assert.equal(homeSearchHref("Elm Hall"), "/search?name=Elm+Hall");
});

test("an empty box, or one with only spaces, goes to an empty name", () => {
  for (const text of ["", "   "]) {
    assert.equal(homeSearchHref(text), "/search?name=", JSON.stringify(text));
  }
});
