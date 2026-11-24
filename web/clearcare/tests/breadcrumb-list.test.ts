// tests/breadcrumb-list.test.ts
// The trail a search engine is given with each page (lib/breadcrumb-list.ts). Search Console reports
// an item whose URL isn't a full address ("Invalid URL in field 'id'"), so each one is checked.
// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";

import { breadcrumbList } from "../lib/breadcrumb-list.ts";

const HOME = { label: "Home", href: "/" };
const SEARCH = { label: "Search for Homes", href: "/search" };
const CORK = { label: "Co. Cork", href: "/search?county=Cork" };

test("every crumb's URL is a full address on the live site, its query kept", () => {
  const { itemListElement } = breadcrumbList([HOME, SEARCH, CORK], "Bantry Nursing Home");

  assert.deepEqual(itemListElement.slice(0, 3), [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://clearcare.ie/" },
    { "@type": "ListItem", position: 2, name: "Search for Homes", item: "https://clearcare.ie/search" },
    { "@type": "ListItem", position: 3, name: "Co. Cork", item: "https://clearcare.ie/search?county=Cork" },
  ]);
});

test("the page itself comes last, with no URL", () => {
  const { itemListElement } = breadcrumbList([HOME], "Resources");

  assert.deepEqual(itemListElement.at(-1), { "@type": "ListItem", position: 2, name: "Resources" });
});
