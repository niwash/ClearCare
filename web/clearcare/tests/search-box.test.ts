// tests/search-box.test.ts
// What the search box does to a search (CCARE-228, CCARE-230): a suggestion read as a county or as a
// place, what picking, typing and "Use my location" change, and the rule Search follows for text that
// wasn't picked. Google and the homes' names are functions each test replaces.
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  editedText,
  needsLookup,
  NOBODY_TO_ASK,
  pickedCounty,
  pickedName,
  pickedPlace,
  readSuggestion,
  settleBox,
  typedText,
  usedLocation,
  withoutPlace,
  type PlaceSuggestion,
} from "../lib/search-box.ts";
import { NO_FILTERS } from "../lib/search-filters.ts";

const DRAFT = { name: "", place: "", near: "", county: "", selection: NO_FILTERS, sort: "name" as const };
const RATHMINES = { ...DRAFT, place: "Rathmines, Dublin", near: "53.32,-6.27", sort: "distance" as const };

// Google's answer for a place, located at near: "Rathmines, Dublin" is Rathmines, in Dublin.
function suggestion(label: string, near: string): PlaceSuggestion {
  return { main: label.split(",")[0], label, county: null, locate: async () => near };
}

const NEVER = new Promise<void>(() => {});
const NOW = Promise.resolve();

// What Search asks while settling text. By default no home has the name, Google isn't in use and
// nothing is too late; neither may be asked unless the test says what it answers.
function asking(answers: Partial<Parameters<typeof settleBox>[1]> = {}) {
  return { searched: DRAFT, pick: null, hasName: async () => false, findFirst: null, deadline: NEVER, ...answers };
}
const notAsked = (who: string) => async () => assert.fail(`${who} was asked`);

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

  test("keeps the place's own name, which Search compares with text that wasn't picked", () => {
    assert.equal(readSuggestion({ mainText: "Swords", secondaryText: "County Dublin, Ireland" }).main, "Swords");
  });
});

describe("the search box", () => {
  test("picking a home searches for its name, in place of the text typed", () => {
    assert.deepEqual(pickedName({ ...DRAFT, place: "elm h" }, "Elm Hall Nursing Home"), { ...DRAFT, name: "Elm Hall Nursing Home" });
  });

  test("picking a county sets the county filter and clears the place, its point and the distance order", () => {
    assert.deepEqual(pickedCounty(RATHMINES, "Cavan"), { ...DRAFT, county: "Cavan" });
  });

  test("picking a county keeps an order other than distance", () => {
    assert.equal(pickedCounty({ ...DRAFT, sort: "latest_inspection" }, "Cavan").sort, "latest_inspection");
  });

  test("picking a place measures from it, nearest first, and keeps the other choices", () => {
    const draft = { ...DRAFT, county: "Dublin", selection: { ...NO_FILTERS, care: ["dementia"] } };

    assert.deepEqual(pickedPlace(draft, "Rathmines, Dublin", "53.32,-6.27"), {
      ...draft,
      place: "Rathmines, Dublin",
      near: "53.32,-6.27",
      sort: "distance",
    });
  });

  test("typing replaces the name that was searched for", () => {
    assert.deepEqual(typedText({ ...DRAFT, name: "Elm Hall" }, "Rath"), { ...DRAFT, place: "Rath" });
  });

  test("typing after a place was picked drops its point, and the distance order with it", () => {
    assert.deepEqual(typedText(RATHMINES, "Rathmin"), { ...DRAFT, place: "Rathmin" });
  });

  test("emptying the box returns to name order, and keeps an order chosen without distance", () => {
    assert.deepEqual(typedText(RATHMINES, ""), DRAFT);
    assert.equal(typedText({ ...RATHMINES, sort: "latest_inspection" }, "").sort, "latest_inspection");
  });

  test("using the location clears text that wasn't searched, nearest first", () => {
    assert.deepEqual(usedLocation({ ...DRAFT, place: "Cavan" }, "53.99,-7.36"), { ...DRAFT, near: "53.99,-7.36", sort: "distance" });
  });

  test("using the location keeps a name already searched for", () => {
    assert.deepEqual(usedLocation({ ...DRAFT, name: "elm" }, "53.99,-7.36"), { ...DRAFT, name: "elm", near: "53.99,-7.36", sort: "distance" });
  });

  // A link can hold a name and a place; the box shows the name, with the place under it.
  test("removing the place from under the box keeps the name", () => {
    assert.deepEqual(withoutPlace({ ...RATHMINES, name: "elm" }), { ...DRAFT, name: "elm" });
  });
});

// One rule, in this order. A whole place name beats a name match, and a name match beats part of a
// place name: "Swords" finds the homes nearest Swords, and "elm" still finds Elm Hall, not Elm Park.
describe("text that wasn't picked, when Search is pressed", () => {
  const SWORDS = { ...DRAFT, place: "Swords, County Dublin", near: "53.46,-6.22", sort: "distance" as const };
  const swords = async () => suggestion("Swords, County Dublin", "53.46,-6.22");

  test("1. is the county filter when it is a county's name, and nobody is asked", async () => {
    for (const place of ["Cavan", "co cavan"]) {
      const settled = await settleBox({ ...DRAFT, place }, asking({ hasName: notAsked("the names"), findFirst: notAsked("Google") }));

      assert.deepEqual(settled, { ...DRAFT, county: "Cavan" }, place);
    }
  });

  test("1. is a place when it is a full Eircode, looked up without the names being asked", async () => {
    const settled = await settleBox(
      { ...DRAFT, place: "W23 P6EX" },
      asking({ hasName: notAsked("the names"), findFirst: async () => suggestion("W23 P6EX", "53.34,-6.54") }),
    );

    assert.deepEqual(settled, { ...DRAFT, place: "W23 P6EX", near: "53.34,-6.54", sort: "distance" });
  });

  test("1. stays an Eircode when it is one Google can't place", async () => {
    const draft = { ...DRAFT, place: "W23 P6EX" };

    assert.deepEqual(await settleBox(draft, asking({ findFirst: async () => null })), draft);
  });

  // A routing key keeps the Eircode filter it has always had rather than becoming one point.
  test("1. stays an Eircode when it is a routing key alone, and nobody is asked", async () => {
    for (const place of ["D6W", "a98", "A 98"]) {
      const draft = { ...DRAFT, place };

      assert.deepEqual(await settleBox(draft, asking({ hasName: notAsked("the names"), findFirst: notAsked("Google") })), draft, place);
      assert.equal(needsLookup(draft, DRAFT), false, place);
    }
  });

  test("2. is searched nearest the place it names in full, even when a home's name matches it", async () => {
    for (const place of ["Swords", " swords "]) {
      const settled = await settleBox({ ...DRAFT, place }, asking({ hasName: async () => true, findFirst: swords }));

      assert.deepEqual(settled, SWORDS, place);
    }
  });

  test("3. is a name search when a home's name matches it and it is only part of a place's name", async () => {
    const elmPark = { main: "Elm Park", label: "Elm Park, Dublin", county: null, locate: notAsked("Google, for where Elm Park is") };
    const settled = await settleBox({ ...DRAFT, place: " elm " }, asking({ hasName: async (text) => text === "elm", findFirst: async () => elmPark }));

    assert.deepEqual(settled, { ...DRAFT, name: "elm" });
  });

  test("4. takes Google's first suggestion, as if it had been picked, when no home's name matches it", async () => {
    const settled = await settleBox({ ...DRAFT, place: "rathm" }, asking({ findFirst: async () => suggestion("Rathmines, Dublin", "53.32,-6.27") }));

    assert.deepEqual(settled, RATHMINES);
  });

  test("4. sets the county filter when that suggestion is a county", async () => {
    const county = { main: "County Cavan", label: "County Cavan", county: "Cavan", locate: notAsked("Google, for where a county is") };
    const settled = await settleBox({ ...DRAFT, place: "county cav" }, asking({ findFirst: async () => county }));

    assert.deepEqual(settled, { ...DRAFT, county: "Cavan" });
  });

  test("4. takes that suggestion when the names can't be read", async () => {
    const settled = await settleBox(
      { ...DRAFT, place: "rathm" },
      asking({ hasName: async () => Promise.reject(new Error("offline")), findFirst: async () => suggestion("Rathmines, Dublin", "53.32,-6.27") }),
    );

    assert.deepEqual(settled, RATHMINES);
  });

  // So the page can say that nothing was found for it.
  test("5. is searched as a name when Google can't place it: no suggestion, too late, or failing", async () => {
    const draft = { ...DRAFT, place: "Elm Hall Road" };
    const searchedAsName = { ...DRAFT, name: "Elm Hall Road" };
    const late = () => new Promise<PlaceSuggestion>(() => {});
    const failing = async () => Promise.reject(new Error("offline"));

    assert.deepEqual(await settleBox(draft, asking({ findFirst: async () => null })), searchedAsName);
    assert.deepEqual(await settleBox(draft, asking({ findFirst: late, deadline: NOW })), searchedAsName);
    assert.deepEqual(await settleBox(draft, asking({ findFirst: failing })), searchedAsName);
    assert.deepEqual(await settleBox(draft, asking({ findFirst: async () => suggestion("Elm Hall Road", "") })), searchedAsName);
  });

  test("without Google (no key, or it failed to load) is searched as a name, whether or not a home has it", async () => {
    for (const named of [true, false]) {
      const settled = await settleBox({ ...DRAFT, place: "Swords" }, asking({ hasName: async () => named, findFirst: null }));

      assert.deepEqual(settled, { ...DRAFT, name: "Swords" });
    }
  });

  test("is never sent to Google when it is a single character", async () => {
    assert.deepEqual(await settleBox({ ...DRAFT, place: "C" }, asking({ findFirst: notAsked("Google") })), { ...DRAFT, name: "C" });
  });

  test("isn't settled again once the page has searched it as it is", async () => {
    const searched = { ...DRAFT, place: "D06 X2P7" };
    const draft = { ...searched, county: "Dublin" };

    assert.equal(needsLookup(draft, searched), false);
    assert.equal(needsLookup({ ...draft, place: "D06 X2P" }, searched), true);
    assert.deepEqual(await settleBox(draft, asking({ searched, hasName: notAsked("the names"), findFirst: notAsked("Google") })), draft);
  });

  // A link can hold a name and a place. The box shows the name, so the place was never its text.
  test("is settled when it is typed over a name, though the page searched the same word as a place", async () => {
    const searched = { ...DRAFT, name: "Nursing", place: "Dublin" };

    assert.deepEqual(await settleBox(typedText(searched, "Dublin"), asking({ searched })), { ...DRAFT, county: "Dublin" });
  });

  test("leaves a search with a name as it is, with its place", async () => {
    const nobody = { hasName: notAsked("the names"), findFirst: notAsked("Google") };
    const named = { ...DRAFT, name: "elm", county: "Kildare" };
    const namedInAPlace = { ...DRAFT, name: "Nursing", place: "Dublin" };

    assert.deepEqual(await settleBox(named, asking(nobody)), named);
    assert.deepEqual(await settleBox(namedInAPlace, asking({ searched: namedInAPlace, ...nobody })), namedInAPlace);
  });

  test("waits for a pick still asking Google where it is", async () => {
    let answer!: (near: string) => void;
    const pick = { label: "Rathmines, Dublin", near: new Promise<string>((resolve) => (answer = resolve)) };
    const settled = settleBox({ ...DRAFT, place: "Rathmines, Dublin" }, asking({ pick }));
    answer("53.32,-6.27");

    assert.deepEqual(await settled, RATHMINES);
  });

  test("leaves a picked place that has its point as it is", async () => {
    assert.deepEqual(await settleBox(RATHMINES, asking({ hasName: notAsked("the names"), findFirst: notAsked("Google") })), RATHMINES);
  });
});

// A form sent without scripts reaches the server, where there is no Google: the home page's box,
// and the search page's (CCARE-219).
describe("text sent with nobody to ask", () => {
  const settled = (place: string) => settleBox({ ...DRAFT, place }, { ...NOBODY_TO_ASK, searched: DRAFT });

  test("is the county filter when it is a county's name, as the API spells it", async () => {
    for (const text of ["Cavan", "co cavan"]) {
      assert.deepEqual(await settled(text), { ...DRAFT, county: "Cavan" }, text);
    }
  });

  test("is the place when it is an Eircode, with or without its space", async () => {
    for (const text of ["W23 P6EX", "W23P6EX", "DO6"]) {
      assert.deepEqual(await settled(text), { ...DRAFT, place: text }, text);
    }
  });

  test("is a name when it is anything else", async () => {
    assert.deepEqual(await settled("Elm Hall"), { ...DRAFT, name: "Elm Hall" });
  });

  test("is no search when the box was empty", async () => {
    assert.deepEqual(await settled(""), DRAFT);
  });
});

// What the page's box showed is the search's name, or its place.
describe("text that is what the page's box showed", () => {
  const SEARCHES = [{ ...DRAFT, name: "Elm" }, { ...DRAFT, place: "Celbridge" }, { ...DRAFT, name: "Nursing", place: "Celbridge", county: "Kildare" }, RATHMINES];

  test("goes on as the search it was after a letter is typed and deleted: a name stays a name, a place keeps its point", () => {
    for (const searched of SEARCHES) {
      const shown = searched.name || searched.place;
      const withLetter = editedText(searched, `${shown}x`, searched);

      assert.deepEqual(withLetter, { ...DRAFT, place: `${shown}x`, county: searched.county }, shown);
      assert.deepEqual(editedText(withLetter, shown, searched), searched, shown);
    }
  });

  test("keeps the filters chosen while it was being edited", () => {
    const searched = { ...DRAFT, name: "Elm" };
    const withLetter = { ...editedText(searched, "Elmx", searched), county: "Kildare" };

    assert.deepEqual(editedText(withLetter, "Elm", searched), { ...searched, county: "Kildare" });
  });

  // The search page's form sends the box's text beside the search it was drawn from.
  test("goes on as the search it was when a form is sent without scripts and nobody edited it", () => {
    for (const sent of SEARCHES) {
      assert.deepEqual(editedText(sent, sent.name || sent.place, sent), sent);
    }
  });

  test("is replaced, name and place, by any other text", () => {
    const sent = { ...RATHMINES, name: "Nursing", county: "Dublin" };

    assert.deepEqual(editedText(sent, "elm", sent), { ...DRAFT, place: "elm", county: "Dublin" });
  });
});
