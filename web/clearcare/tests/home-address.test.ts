// tests/home-address.test.ts
// The addresses of a county's page and a home's pages (lib/home-address.ts, CCARE-297).
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { COUNTIES } from "../lib/counties.ts";
import {
  addressWords,
  countyFromSlug,
  countyPath,
  homeIdFrom,
  homeInPath,
  homePath,
  homeSegment,
  sectionFrom,
} from "../lib/home-address.ts";

const CONNA = { centre_id: "4447", centre_name: "Conna Care Home", county: "Cork" };

describe("a part of an address", () => {
  test("is the words in lower case, joined by hyphens", () => {
    assert.equal(addressWords("Conna Care Home"), "conna-care-home");
  });

  test("drops accents and apostrophes, and reads & as and", () => {
    assert.equal(addressWords("St. Joseph’s & Mary's"), "st-josephs-and-marys");
    assert.equal(addressWords("Áras Mhuire"), "aras-mhuire");
  });

  test("has no hyphen at either end, nor two together", () => {
    assert.equal(addressWords("  (The) Glebe -- House  "), "the-glebe-house");
  });
});

describe("a county's page", () => {
  test("is under /nursing-homes, in lower case, with the page from the second on", () => {
    assert.equal(countyPath("Cork"), "/nursing-homes/cork");
    assert.equal(countyPath("Cork", 1), "/nursing-homes/cork");
    assert.equal(countyPath("Cork", 2), "/nursing-homes/cork?page=2");
  });

  test("names its county back, for every county, and no other", () => {
    for (const county of COUNTIES) assert.equal(countyFromSlug(countyPath(county).split("/")[2]), county);
    assert.equal(countyFromSlug("narnia"), null);
    assert.equal(countyFromSlug("Cork"), null);
  });
});

describe("a home's page", () => {
  test("is under its county, by its name and then its centre ID", () => {
    assert.equal(homePath(CONNA), "/nursing-homes/cork/conna-care-home-4447");
    assert.equal(homePath(CONNA, "what-to-ask"), "/nursing-homes/cork/conna-care-home-4447/what-to-ask");
  });

  test("is the centre ID alone for a name with no letters or digits", () => {
    assert.equal(homeSegment({ centre_id: "12", centre_name: "—" }), "12");
  });

  test("is found by the centre ID its part ends with, or the ID alone", () => {
    assert.equal(homeIdFrom("conna-care-home-4447"), "4447");
    assert.equal(homeIdFrom("a-home-renamed-since-4447"), "4447");
    assert.equal(homeIdFrom("4447"), "4447");
    assert.equal(homeIdFrom("conna-care-home"), null);
    assert.equal(homeIdFrom("4447-conna"), null);
    assert.equal(homeIdFrom("conna-123456789"), null);
  });

  test("is told from the path of any of its pages, with the tab", () => {
    assert.deepEqual(homeInPath("/nursing-homes/cork/conna-care-home-4447"), { id: "4447", tab: "" });
    assert.deepEqual(homeInPath("/nursing-homes/cork/conna-care-home-4447/inspections"), { id: "4447", tab: "inspections" });
    assert.equal(homeInPath("/nursing-homes/cork"), null);
    assert.equal(homeInPath("/search"), null);
  });
});

describe("a tab named by its address", () => {
  test("is the tab, by its address now or the one it had before", () => {
    assert.equal(sectionFrom("issues-found"), "issues-found");
    assert.equal(sectionFrom("look-first"), "issues-found");
    assert.equal(sectionFrom("next-steps"), "how-the-home-responded");
    assert.equal(sectionFrom("questions"), "what-to-ask");
    assert.equal(sectionFrom("inspections"), "inspections");
  });

  test("is none for any other word, including an inherited key", () => {
    assert.equal(sectionFrom("record.csv"), null);
    assert.equal(sectionFrom("constructor"), null);
  });
});
