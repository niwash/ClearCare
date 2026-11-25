// tests/nav-current.test.ts
// Which navigation link shows where the visitor is (lib/nav-current.ts, CCARE-296): the page's own
// link, or the link for the section the page sits in, so a guide reached from Resources still
// shows Resources.
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { currentness } from "../lib/nav-current.ts";

describe("the navigation link that shows where the visitor is", () => {
  test("is the page's own link on the page itself", () => {
    assert.equal(currentness("/", "/"), "page");
    assert.equal(currentness("/resources", "/resources"), "page");
    assert.equal(currentness("/guides/fair-deal", "/guides/fair-deal"), "page");
  });

  test("is the section's link on a page under it", () => {
    assert.equal(currentness("/resources", "/resources/glossary"), "true");
    assert.equal(currentness("/resources", "/guides/reading-inspection-reports"), "true");
    assert.equal(currentness("/search", "/nursing-homes/cork/conna-care-home-4447"), "true");
    assert.equal(currentness("/search", "/nursing-homes/cork/conna-care-home-4447/inspections"), "true");
    assert.equal(currentness("/national-figures", "/national-figures/re-assessment"), "true");
  });

  test("leaves Fair Deal to its own link, not Resources", () => {
    assert.equal(currentness("/resources", "/guides/fair-deal"), undefined);
  });

  test("never marks Home for another page, nor a link whose address only starts the same", () => {
    assert.equal(currentness("/", "/resources"), undefined);
    assert.equal(currentness("/search", "/searching"), undefined);
  });

  test("marks nothing for a page the navigation doesn't cover", () => {
    for (const href of ["/", "/search", "/compare", "/guides/fair-deal", "/support-services", "/resources", "/national-figures", "/survey"]) {
      assert.equal(currentness(href, "/privacy"), undefined, href);
    }
    assert.equal(currentness(null, "/resources"), undefined);
  });
});
