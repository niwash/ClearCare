// tests/return-to-centre.test.ts
// The way back to a home's record from a guide opened from it (lib/return-to-centre.ts, CCARE-212):
// every tab gets its link, by its address since CCARE-297 or before it, and nothing else does.
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { returnQuery, returnToCentre } from "../lib/return-to-centre.ts";

const back = (query: string) => returnToCentre(new URLSearchParams(query));

describe("the way back to a home from a guide", () => {
  test("is offered from What to ask, as its link sends it (PR #242 review)", () => {
    assert.deepEqual(back(returnQuery("4447", "what-to-ask")), {
      href: "/centres/4447/what-to-ask",
      label: "Back to the home: What to ask",
    });
  });

  test("is offered from the overview and Issues found", () => {
    assert.equal(back(returnQuery("4447"))?.href, "/centres/4447");
    assert.equal(back(returnQuery("4447", "issues-found"))?.label, "Back to the home: Issues found");
  });

  test("reads a tab's address from before CCARE-297 as its new one", () => {
    assert.equal(back("from=centre&centre=4447&tab=questions")?.href, "/centres/4447/what-to-ask");
    assert.equal(back("from=centre&centre=4447&tab=look-first")?.href, "/centres/4447/issues-found");
  });

  test("isn't offered for anything else", () => {
    assert.equal(back("centre=4447&tab=what-to-ask"), null);
    assert.equal(back("from=centre&centre=abc&tab=what-to-ask"), null);
    assert.equal(back("from=centre&centre=4447&tab=constructor"), null);
    assert.equal(back("from=centre&centre=4447&tab=record.csv"), null);
  });
});
