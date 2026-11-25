// tests/regulation-guide.test.ts
// ClearCare's own words for each regulation on the regulations page (lib/regulation-guide.ts,
// CCARE-261): every regulation HIQA inspects is in one theme, and has a plain-English line.
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { REGULATION_GUIDE, REGULATION_THEMES } from "../lib/regulation-guide.ts";
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
