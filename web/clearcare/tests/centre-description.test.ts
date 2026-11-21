// tests/centre-description.test.ts
// What a search engine shows under a home's page (lib/centre-description.ts): the home's own facts,
// so one home's result reads differently from the next.
// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";

import { centreDescription } from "../lib/centre-description.ts";

const glebe = { name: "Glebe House Nursing Home", where: "Kilternan, Co. Dublin", residents: 54, price: "€1,418", inspected: "12 Nov 2025" };

test("the overview gives where the home is, its size, its price and its latest inspection", () => {
  assert.equal(
    centreDescription(glebe),
    "Glebe House Nursing Home, Kilternan, Co. Dublin: up to 54 residents, Fair Deal €1,418 a week, inspected by HIQA on 12 Nov 2025. What the inspectors found and how the home responded.",
  );
});

test("a fact the home doesn't have is left out", () => {
  assert.equal(
    centreDescription({ ...glebe, residents: null, price: null, inspected: null }),
    "Glebe House Nursing Home, Kilternan, Co. Dublin. What the inspectors found and how the home responded.",
  );
  assert.equal(
    centreDescription({ ...glebe, price: null }),
    "Glebe House Nursing Home, Kilternan, Co. Dublin: up to 54 residents, inspected by HIQA on 12 Nov 2025. What the inspectors found and how the home responded.",
  );
});

test("each tab says what it holds for that home", () => {
  assert.equal(
    centreDescription(glebe, "look-first"),
    "What HIQA's inspectors found at Glebe House Nursing Home, Kilternan, Co. Dublin, in the words of the inspection report.",
  );
  assert.equal(
    centreDescription(glebe, "next-steps"),
    "What Glebe House Nursing Home, Kilternan, Co. Dublin, said it would do about each inspection finding, and how the next inspection judged it.",
  );
  assert.equal(
    centreDescription(glebe, "inspections"),
    "Every HIQA inspection of Glebe House Nursing Home, Kilternan, Co. Dublin: how each regulation was judged, and what has changed at the home.",
  );
  assert.equal(
    centreDescription(glebe, "questions"),
    "Questions to ask on a visit to Glebe House Nursing Home, Kilternan, Co. Dublin, from what its inspection reports say.",
  );
});
