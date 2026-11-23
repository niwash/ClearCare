// tests/glossary.test.ts
// The glossary under Resources (lib/glossary.ts, CCARE-283): each term is an anchor other pages can
// link to, so ids must be unique, and each "More in" link must reach a page, and a section, that is
// there.
// Run with: npm test
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { GLOSSARY } from "../lib/glossary.ts";
import { FILTER_GROUPS } from "../lib/search-filters.ts";

const terms = GLOSSARY.flatMap((group) => group.terms);

describe("the glossary", () => {
  test("gives every term and group its own anchor", () => {
    const ids = [...GLOSSARY.map((group) => group.id), ...terms.map((term) => term.id)];

    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  test("explains every judgement a home's inspection history shows", () => {
    const judged = terms.flatMap((term) => (term.judgement ? [term.judgement] : []));

    assert.deepEqual(judged.sort(), ["compliant", "not-assessed", "not-compliant", "substantially-compliant"]);
  });

  test("explains every care type the search can filter by, and no other", () => {
    const filters = FILTER_GROUPS.find((group) => group.key === "care")!.options.map((option) => option.label);
    const explained = GLOSSARY.find((group) => group.id === "care-types")!.terms.map((term) => term.term);

    assert.deepEqual(explained.sort(), filters.sort());
  });

  test("links only to pages and sections that exist", () => {
    for (const { more } of terms) {
      if (!more) continue;
      const [path, section] = more.href.split("#");
      const page = new URL(`../app/(site)${path}/page.tsx`, import.meta.url);

      assert.ok(existsSync(page), `${more.href}: no page at ${path}`);
      if (section) assert.match(readFileSync(page, "utf8"), new RegExp(`id: "${section}"`), `${more.href}: no section ${section}`);
    }
  });
});
