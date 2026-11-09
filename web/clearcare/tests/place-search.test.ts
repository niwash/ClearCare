// tests/place-search.test.ts
// What the place box does to a search (CCARE-228): a suggestion read as a county or as a place, what
// picking, typing and "Use my location" change, and what Search does with text that wasn't picked.
// Google is a function each test replaces.
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  needsLookup,
  pickedCounty,
  pickedPlace,
  readSuggestion,
  settlePlace,
  typedPlace,
  usedLocation,
  type PlaceSuggestion,
} from "../lib/place-search.ts";
import { NO_FILTERS } from "../lib/search-filters.ts";

const DRAFT = { name: "", place: "", near: "", county: "", selection: NO_FILTERS, sort: "name" as const };
const RATHMINES = { ...DRAFT, place: "Rathmines, Dublin", near: "53.32,-6.27", sort: "distance" as const };

// Google's answer for a place, located at near.
function suggestion(label: string, near: string): PlaceSuggestion {
  return { label, county: null, locate: async () => near };
}

const NEVER = new Promise<void>(() => {});
const NOW = Promise.resolve();

describe("a suggestion", () => {
  test("is a county when its main text is County and a county the register has", () => {
    assert.equal(readSuggestion({ mainText: "County Cavan", secondaryText: "Ireland" }).county, "Cavan");
  });

  // Google's types don't tell them apart: administrative_area_level_2 is also Cork City, and a
  // Roscommon inside County Roscommon.
  test("is a place when it is a town, an area or a city, even one named after its county", () => {
    for (const mainText of ["Cavan", "Cork City", "Roscommon", "Rathmines", "A98 C2C0"]) {
      assert.equal(readSuggestion({ mainText, secondaryText: "Ireland" }).county, null, mainText);
    }
  });

  test("puts its name in the box without the country, since every suggestion is in Ireland", () => {
    // As Google gave them on 9 Nov 2026.
    assert.equal(readSuggestion({ mainText: "Rathmines", secondaryText: "Dublin, Ireland" }).label, "Rathmines, Dublin");
    assert.equal(readSuggestion({ mainText: "Cavan", secondaryText: "Ireland" }).label, "Cavan");
    // The region bias can leave the second line out.
    assert.equal(readSuggestion({ mainText: "Dublin 6", secondaryText: "" }).label, "Dublin 6");
  });
});

describe("the place box", () => {
  test("picking a county sets the county filter and clears the place, its point and the distance order", () => {
    assert.deepEqual(pickedCounty(RATHMINES, "Cavan"), { ...DRAFT, county: "Cavan" });
  });

  test("picking a county keeps an order other than distance", () => {
    assert.equal(pickedCounty({ ...DRAFT, sort: "latest_inspection" }, "Cavan").sort, "latest_inspection");
  });

  test("picking a place measures from it, nearest first, and keeps the other choices", () => {
    const draft = { ...DRAFT, name: "elm", county: "Dublin", selection: { ...NO_FILTERS, care: ["dementia"] } };

    assert.deepEqual(pickedPlace(draft, "Rathmines, Dublin", "53.32,-6.27"), {
      ...draft,
      place: "Rathmines, Dublin",
      near: "53.32,-6.27",
      sort: "distance",
    });
  });

  test("editing the box after a pick drops the point, and the distance order with it", () => {
    assert.deepEqual(typedPlace(RATHMINES, "Rathmin"), { ...DRAFT, place: "Rathmin" });
  });

  test("emptying the box returns to name order, and keeps an order chosen without distance", () => {
    assert.deepEqual(typedPlace(RATHMINES, ""), DRAFT);
    assert.equal(typedPlace({ ...RATHMINES, sort: "latest_inspection" }, "").sort, "latest_inspection");
  });

  test("using the location leaves the box empty, nearest first", () => {
    assert.deepEqual(usedLocation({ ...DRAFT, place: "Cavan" }, "53.99,-7.36"), { ...DRAFT, near: "53.99,-7.36", sort: "distance" });
  });
});

describe("text that wasn't picked, when Search is pressed", () => {
  test("is looked up, and the first suggestion used as if it had been picked", async () => {
    const settled = await settlePlace(
      { ...DRAFT, place: "rathmines" },
      { searched: DRAFT, pick: null, findFirst: async () => suggestion("Rathmines, Dublin", "53.32,-6.27"), deadline: NEVER },
    );

    assert.deepEqual(settled, RATHMINES);
  });

  test("whose first suggestion is a county sets the county filter", async () => {
    const county = { label: "County Cavan", county: "Cavan", locate: async () => assert.fail("a county isn't located") };
    const settled = await settlePlace({ ...DRAFT, place: "county cav" }, { searched: DRAFT, pick: null, findFirst: async () => county, deadline: NEVER });

    assert.deepEqual(settled, { ...DRAFT, county: "Cavan" });
  });

  test("with no suggestion is searched as an address or Eircode, as before", async () => {
    const draft = { ...DRAFT, place: "Elm Hall Road" };

    assert.deepEqual(await settlePlace(draft, { searched: DRAFT, pick: null, findFirst: async () => null, deadline: NEVER }), draft);
  });

  test("is searched as text when Google answers too late, or fails", async () => {
    const draft = { ...DRAFT, place: "Swords" };
    const late = () => new Promise<PlaceSuggestion>(() => {});
    const failing = async () => Promise.reject(new Error("offline"));

    assert.deepEqual(await settlePlace(draft, { searched: DRAFT, pick: null, findFirst: late, deadline: NOW }), draft);
    assert.deepEqual(await settlePlace(draft, { searched: DRAFT, pick: null, findFirst: failing, deadline: NEVER }), draft);
  });

  test("is searched as text when Google isn't in use: no key, or it failed to load", async () => {
    const draft = { ...DRAFT, place: "Swords" };

    assert.deepEqual(await settlePlace(draft, { searched: DRAFT, pick: null, findFirst: null, deadline: NEVER }), draft);
  });

  test("is never sent to Google when it is a routing key alone, or a single character", async () => {
    for (const place of ["D6W", "a98", "A 98", "C"]) {
      const draft = { ...DRAFT, place };
      const settled = await settlePlace(draft, {
        searched: DRAFT,
        pick: null,
        findFirst: async () => assert.fail(`${place} was sent to Google`),
        deadline: NEVER,
      });

      assert.deepEqual(settled, draft, place);
      assert.equal(needsLookup(draft, DRAFT), false, place);
    }
  });

  test("isn't asked about again once the page has searched it as text", async () => {
    const searched = { ...DRAFT, place: "Elm Hall Road" };
    const draft = { ...searched, county: "Kildare" };

    assert.equal(needsLookup(draft, searched), false);
    assert.equal(needsLookup({ ...draft, place: "Elm Hall" }, searched), true);
  });

  test("waits for a pick still asking Google where it is", async () => {
    let answer!: (near: string) => void;
    const pick = { label: "Rathmines, Dublin", near: new Promise<string>((resolve) => (answer = resolve)) };
    const settled = settlePlace({ ...DRAFT, place: "Rathmines, Dublin" }, { searched: DRAFT, pick, findFirst: null, deadline: NEVER });
    answer("53.32,-6.27");

    assert.deepEqual(await settled, RATHMINES);
  });

  test("leaves a picked place that has its point as it is", async () => {
    assert.deepEqual(
      await settlePlace(RATHMINES, { searched: DRAFT, pick: null, findFirst: async () => assert.fail("asked again"), deadline: NEVER }),
      RATHMINES,
    );
  });
});
