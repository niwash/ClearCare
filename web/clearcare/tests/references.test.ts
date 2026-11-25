// tests/references.test.ts
// The sources pages cite in their References (lib/references.ts, CCARE-299): each has its own anchor
// and a full entry, and a page's list letters two by the same author and year for that page alone.
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { pageReferences, REFERENCES } from "../lib/references.ts";

describe("the sources pages cite", () => {
  test("each have their own anchor, and everything a full entry needs", () => {
    const sources = Object.values(REFERENCES);
    const ids = sources.map((source) => source.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const source of sources) {
      assert.match(source.id, /^ref-[a-z0-9]+(-[a-z0-9]+)*$/);
      assert.match(source.url, /^https:\/\//, source.id);
      assert.match(source.year, /^(\d{4}|n\.d\.)$/, source.id);
      assert.ok(source.author && source.title && source.detail.endsWith("."), source.id);
      assert.ok(source.short || source.cite, `${source.id} needs a short author or a citation`);
    }
  });
});

describe("a page's list of references", () => {
  test("is ordered by author, then year, then title", () => {
    const { list } = pageReferences(["hseThreeYearCap", "hiqaStandards", "hiqaFramework"]);
    assert.deepEqual(
      list.map((reference) => reference.id),
      ["ref-hiqa-standards", "ref-hiqa-framework", "ref-hse-three-year-cap"],
    );
  });

  test("letters two by the same author and year, and only on that page", () => {
    // By title within the author and year: "Fair Deal scheme: 3-year cap" before "…: Financial assessment".
    const both = pageReferences(["hseFinancialAssessment", "hseThreeYearCap"]);
    assert.equal(both.hseThreeYearCap.cite, "HSE, n.d.a");
    assert.equal(both.hseFinancialAssessment.cite, "HSE, n.d.b");

    const one = pageReferences(["hseThreeYearCap"]);
    assert.equal(one.hseThreeYearCap.cite, "HSE, n.d.");
  });

  test("cites a statute by its number rather than by author and year", () => {
    assert.equal(pageReferences(["careRegulations"]).careRegulations.cite, "S.I. No. 415 of 2013");
  });
});
