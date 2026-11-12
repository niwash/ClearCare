// tests/counties.test.ts
// Which text typed into a search box names a county (CCARE-219): that text applies the county
// filter (tests/search-box.test.ts), and any other text is searched as before. And how many centres
// each county has among the map's points.
// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";

import { centresByCounty, countyNamed } from "../lib/counties.ts";

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

// "Browse by county" before anything is searched (CCARE-230), counted from the points of the map.
test("the centres in each county are counted, in the counties' own order", () => {
  const points = [{ county: "Dublin" }, { county: "Wicklow" }, { county: "Carlow" }, { county: "Dublin" }];

  assert.deepEqual(centresByCounty(points), [
    { county: "Carlow", centres: 1 },
    { county: "Dublin", centres: 2 },
    { county: "Wicklow", centres: 1 },
  ]);
});

test("a county with no centre among the points is left out, and so is a county the API doesn't list", () => {
  assert.deepEqual(centresByCounty([{ county: "Mayo" }, { county: "Antrim" }]), [{ county: "Mayo", centres: 1 }]);
  assert.deepEqual(centresByCounty([]), []);
});
