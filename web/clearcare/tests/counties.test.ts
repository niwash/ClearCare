// tests/counties.test.ts
// Which text typed into the home page box names a county (CCARE-219): that text applies the county
// filter (tests/home-search.test.ts), and any other text is searched as before.
// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";

import { countyNamed } from "../lib/counties.ts";

test("a county's name, in any case, with or without Co. or County, names it as the API spells it", () => {
  for (const text of ["Cavan", "cavan", "  CAVAN  ", "Co. Cavan", "Co.Cavan", "co cavan", "County Cavan"]) {
    assert.equal(countyNamed(text), "Cavan", text);
  }
  for (const county of ["Cork", "Westmeath", "Meath"]) {
    assert.equal(countyNamed(county), county);
  }
});

test("a town, an address or a home's name is not a county", () => {
  for (const text of ["Cavan Town", "Dublin 8", "Elm Hall", ""]) {
    assert.equal(countyNamed(text), null, text);
  }
});
