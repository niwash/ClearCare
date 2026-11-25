// tests/regulation-guide.test.ts
// ClearCare's own words for each regulation on the regulations page (lib/regulation-guide.ts,
// CCARE-261): every regulation HIQA inspects is in one theme, and has a plain-English line; and the
// lookup a home's findings use for their theme icons agrees with the page (CCARE-298); and a line
// that follows an amendment cites it (CCARE-306).
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { REGULATION_GUIDE, REGULATION_THEMES, regulationTheme } from "../lib/regulation-guide.ts";
import { REFERENCES } from "../lib/references.ts";
import { allRegulations } from "../lib/regulations.ts";

const inspected = allRegulations()
  .filter((regulation) => "quote" in regulation)
  .map((regulation) => regulation.number);
const themed = REGULATION_THEMES.flatMap((theme) => theme.regulations);

describe("the regulations page's themes and plain words", () => {
  test("put every inspected regulation in exactly one theme, and nothing else", () => {
    assert.deepEqual([...themed].sort((a, b) => a - b), inspected);
  });

  test("give every inspected regulation a plain-English line, and no other", () => {
    assert.deepEqual(
      Object.keys(REGULATION_GUIDE).map(Number).sort((a, b) => a - b),
      inspected,
    );
    for (const number of inspected) assert.ok(REGULATION_GUIDE[number].plain.trim(), `Regulation ${number}`);
  });

  test("give each theme its own anchor, apart from the regulations' and the folded group's", () => {
    const ids = REGULATION_THEMES.map((theme) => theme.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.doesNotMatch(id, /^regulation-|^other-regulations$/);
  });
});

describe("the theme a home's finding is shown with (CCARE-298)", () => {
  test("is the theme the regulations page lists it under, for every inspected regulation", () => {
    for (const theme of REGULATION_THEMES) {
      for (const number of theme.regulations) assert.equal(regulationTheme(number)?.id, theme.id, `Regulation ${number}`);
    }
  });

  test("is none for a regulation that isn't inspected, or isn't one", () => {
    assert.equal(regulationTheme(1), null);
    assert.equal(regulationTheme(2), null);
    assert.equal(regulationTheme(99), null);
  });
});

describe("a plain line that follows an amendment (CCARE-306)", () => {
  test("cites a source the references have", () => {
    for (const [number, guide] of Object.entries(REGULATION_GUIDE)) {
      if (guide.amendedBy) assert.ok(Object.hasOwn(REFERENCES, guide.amendedBy), `Regulation ${number}`);
    }
  });

  test("is cited for the notice periods S.I. No. 98 of 2025 changed, in Regulations 31 and 32", () => {
    assert.equal(REGULATION_GUIDE[31].amendedBy, "careRegulations2025");
    assert.equal(REGULATION_GUIDE[32].amendedBy, "careRegulations2025");
  });
});
