// tests/preferences.test.ts
// The saved search: what the site keeps of a search, what it refuses to keep, and the page address
// it comes back to. The document crosses a table the API stores without reading it, so everything
// that decides what is in it is checked here.
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  hasSavedChoices,
  parseSavedSearch,
  savedSearchDocument,
  savedSearchFrom,
  savedSearchHref,
  type SavedSearch,
} from "../lib/preferences.ts";

// The search with nothing in it: what a visitor who has made no choice would leave.
const NO_SAVED_SEARCH: SavedSearch = {
  county: "",
  sort: "name",
  selection: { care: [], room: [], fac: [], act: [] },
};

describe("what is worth saving", () => {
  test("the default search leaves nothing behind", () => {
    assert.equal(hasSavedChoices(NO_SAVED_SEARCH), false);
  });

  test("a county, an order or a ticked option is a choice", () => {
    assert.equal(hasSavedChoices({ ...NO_SAVED_SEARCH, county: "Cork" }), true);
    assert.equal(hasSavedChoices({ ...NO_SAVED_SEARCH, sort: "latest_inspection" }), true);
    assert.equal(
      hasSavedChoices({
        ...NO_SAVED_SEARCH,
        selection: { ...NO_SAVED_SEARCH.selection, care: ["dementia"] },
      }),
      true,
    );
  });

  test("the words typed into the search box are not a preference", () => {
    const saved = savedSearchFrom({ county: "", sort: "name", selection: NO_SAVED_SEARCH.selection });

    assert.equal(hasSavedChoices(saved), false);
  });
});

describe("the document the API stores", () => {
  const saved = {
    county: "Cork",
    sort: "latest_inspection" as const,
    selection: { care: ["dementia", "respite"], room: [], fac: ["garden"], act: [] },
  };

  test("names the four lists as the centres do", () => {
    assert.deepEqual(savedSearchDocument(saved), {
      county: "Cork",
      care_types: ["dementia", "respite"],
      room_types: [],
      facilities: ["garden"],
      activities: [],
      sort_by: "latest_inspection",
    });
    // The keys are the lists a centre carries, not the site's short ones, so a stored preference
    // reads the same way as the data it searches.
    assert.deepEqual(Object.keys(savedSearchDocument(saved)).sort(), [
      "activities",
      "care_types",
      "county",
      "facilities",
      "room_types",
      "sort_by",
    ]);
  });

  test("says any county as null", () => {
    assert.equal(savedSearchDocument(NO_SAVED_SEARCH).county, null);
  });

  test("comes back as the search it was", () => {
    assert.deepEqual(parseSavedSearch(savedSearchDocument(saved)), saved);
  });
});

describe("a saved search the site no longer offers", () => {
  test("keeps the options it still shows, in their order", () => {
    const parsed = parseSavedSearch({
      care_types: ["respite", "dementia", "brain-surgery"],
      room_types: ["en-suite"],
    });

    // The group's own order, and the option that is not one dropped.
    assert.deepEqual(parsed?.selection.care, ["dementia", "respite"]);
    assert.deepEqual(parsed?.selection.room, ["en-suite"]);
  });

  test("drops a county the register does not have", () => {
    assert.equal(parseSavedSearch({ county: "Yorkshire" })?.county, "");
    assert.equal(parseSavedSearch({ county: "Cork" })?.county, "Cork");
  });

  test("falls back to name order", () => {
    assert.equal(parseSavedSearch({ sort_by: "newest" })?.sort, "name");
    assert.equal(parseSavedSearch({ sort_by: "latest_inspection" })?.sort, "latest_inspection");
  });

  test("is no saved search at all when it is not a document", () => {
    assert.equal(parseSavedSearch(null), null);
    assert.equal(parseSavedSearch("Cork"), null);
    assert.equal(parseSavedSearch(undefined), null);
  });

  // Nothing, rather than a half-filled search: an account with nothing saved answers with null.
  test("reads an empty answer as no saved search", () => {
    const parsed = parseSavedSearch({});

    assert.deepEqual(parsed, NO_SAVED_SEARCH);
    assert.equal(hasSavedChoices(parsed!), false);
  });
});

describe("the page address of a saved search", () => {
  test("names the county, the order and the ticked options", () => {
    assert.equal(
      savedSearchHref({
        county: "Cork",
        sort: "latest_inspection",
        selection: { care: ["dementia", "respite"], room: [], fac: ["garden"], act: [] },
      }),
      "/search?county=Cork&care=dementia%2Crespite&fac=garden&sort=latest_inspection",
    );
  });

  test("is the search page itself when nothing is saved", () => {
    assert.equal(savedSearchHref(NO_SAVED_SEARCH), "/search");
  });

  // The href is the page address readSearch expects, so the two agree on every parameter.
  test("leaves out the order when it is the default", () => {
    assert.equal(
      savedSearchHref({ ...NO_SAVED_SEARCH, county: "Dublin" }),
      "/search?county=Dublin",
    );
  });
});

