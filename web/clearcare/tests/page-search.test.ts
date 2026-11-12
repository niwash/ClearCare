// tests/page-search.test.ts
// The search as the page address holds it (lib/page-search.ts): what reaches GET /centres from a
// place with a point to measure from (CCARE-228), and that links from before it search as they did.
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { filtersClearedHref, hasSearch, leavesHomesOut, readSearch, searchHref } from "../lib/page-search.ts";
import { NO_FILTERS } from "../lib/search-filters.ts";

const NOTHING = { name: "", place: "", near: "", county: "", selection: NO_FILTERS, sort: "name" as const };

describe("a search from a place", () => {
  test("measures from near, rounded to two decimals, nearest first", () => {
    const search = readSearch({ place: "Rathmines, Dublin", near: "53.32345,-6.26511", sort: "distance" });

    assert.equal(search.place, "Rathmines, Dublin");
    assert.equal(search.near, "53.32,-6.27");
    assert.equal(search.sort, "distance");
    assert.deepEqual(search.query, { near: "53.32,-6.27", sort: "distance" });
  });

  test("sends the place only as near: its name is a label, not an address or an Eircode", () => {
    for (const place of ["Rathmines, Dublin", "A98 C2C0"]) {
      const { query } = readSearch({ place, near: "53.2,-6.11" });

      assert.equal(query.address, undefined, place);
      assert.equal(query.eircode, undefined, place);
      assert.equal(query.near, "53.2,-6.11", place);
    }
  });

  test("keeps another order with near, so the cards can still show distances", () => {
    const search = readSearch({ place: "Swords, Dublin", near: "53.46,-6.22", sort: "latest_inspection" });

    assert.equal(search.sort, "latest_inspection");
    assert.deepEqual(search.query, { near: "53.46,-6.22", sort: "latest_inspection" });
  });

  test("drops a near that isn't a point, as it drops an unknown order, and searches the place as text", () => {
    const search = readSearch({ place: "Cavan", near: "Cavan" });

    assert.equal(search.near, "");
    assert.deepEqual(search.query, { address: "Cavan" });
  });

  test("falls back to name order when distance is asked for without a point", () => {
    for (const params of [{ sort: "distance" }, { place: "Cavan", near: "91,0", sort: "distance" }]) {
      const search = readSearch(params);

      assert.equal(search.sort, "name", JSON.stringify(params));
      assert.equal(search.query.sort, undefined, JSON.stringify(params));
    }
  });

  test("a point with no name for it is still a search", () => {
    assert.equal(hasSearch(readSearch({ near: "53.35,-6.26", sort: "distance" })), true);
  });
});

describe("whether a search leaves homes out", () => {
  test("a point alone leaves none out: it only orders them", () => {
    assert.equal(leavesHomesOut(readSearch({ place: "Rathmines, Dublin", near: "53.32,-6.27", sort: "distance" })), false);
    assert.equal(leavesHomesOut(readSearch({ near: "53.35,-6.26", sort: "distance" })), false);
    assert.equal(leavesHomesOut(readSearch({ place: "Rathmines, Dublin", near: "53.32,-6.27" })), false);
  });

  test("a name, a county, a ticked filter or a place searched as text does", () => {
    const fromRathmines = { place: "Rathmines, Dublin", near: "53.32,-6.27", sort: "distance" };

    assert.equal(leavesHomesOut(readSearch({ ...fromRathmines, name: "elm" })), true);
    assert.equal(leavesHomesOut(readSearch({ ...fromRathmines, county: "Dublin" })), true);
    assert.equal(leavesHomesOut(readSearch({ ...fromRathmines, care: "dementia" })), true);
    assert.equal(leavesHomesOut(readSearch({ place: "Cavan" })), true);
  });
});

describe("links from before", () => {
  test("place, address or eircode alone search as they did", () => {
    assert.deepEqual(readSearch({ place: "Cavan" }).query, { address: "Cavan" });
    assert.deepEqual(readSearch({ place: "a98 c2co" }).query, { eircode: "A98C2C0" });
    assert.deepEqual(readSearch({ address: "Main Street" }).query, { address: "Main Street" });
    assert.deepEqual(readSearch({ eircode: "W23 P6EX" }).query, { eircode: "W23P6EX" });
  });
});

describe("the page address of a search", () => {
  const fromRathmines = { ...NOTHING, place: "Rathmines, Dublin", near: "53.32,-6.27", sort: "distance" as const };

  test("carries near beside the place, and the distance order", () => {
    assert.equal(searchHref(fromRathmines), "/search?place=Rathmines%2C+Dublin&near=53.32%2C-6.27&sort=distance");
  });

  test("carries near onto the other pages", () => {
    assert.equal(searchHref(fromRathmines, 2), "/search?place=Rathmines%2C+Dublin&near=53.32%2C-6.27&sort=distance&page=2");
  });

  test("carries a point with no name for it", () => {
    assert.equal(searchHref({ ...NOTHING, near: "53.35,-6.26", sort: "distance" }), "/search?near=53.35%2C-6.26&sort=distance");
  });
});

describe("the view", () => {
  test("is the list unless the page address says map", () => {
    assert.equal(readSearch({ name: "elm" }).view, "list");
    assert.equal(readSearch({ name: "elm", view: "map" }).view, "map");
    assert.equal(readSearch({ name: "elm", view: "satellite" }).view, "list");
  });

  test("is the page's own business: GET /centres is not sent it", () => {
    assert.deepEqual(readSearch({ name: "elm", view: "map" }).query, { name: "elm" });
  });

  test("stays in the address of a search, so the filters, the tags and the order keep it", () => {
    assert.equal(searchHref({ ...NOTHING, name: "elm", sort: "latest_inspection", view: "map" }), "/search?name=elm&sort=latest_inspection&view=map");
    assert.equal(searchHref({ ...NOTHING, name: "elm", view: "list" }), "/search?name=elm");
  });

  test("goes with the search: an emptied one is the cleared page, not a map of nothing", () => {
    assert.equal(searchHref({ ...NOTHING, view: "map" }), "/search");
    assert.equal(filtersClearedHref({ ...NOTHING, view: "map" }), "/search?filtersCleared=true");
  });
});
