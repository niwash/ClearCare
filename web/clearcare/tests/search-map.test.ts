// tests/search-map.test.ts
// What the search page's map shows (lib/search-map.ts): first, the nearest few homes around the place
// searched from, or every pin, and never closer in than a town; then all of a chosen home's card.
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { firstView, nearPoint, shiftInto, type CentrePoint } from "../lib/search-map.ts";

function pin(latitude: number, longitude: number, distance_m: number | null = null): CentrePoint {
  return { centre_id: `${latitude},${longitude}`, centre_name: "A home", address: "Main Street", county: "Dublin", latitude, longitude, distance_m };
}

function centre({ north, south, east, west }: ReturnType<typeof firstView>) {
  return { lat: (north + south) / 2, lng: (east + west) / 2 };
}

describe("the map's first view", () => {
  test("without a place, holds every pin", () => {
    const view = firstView([pin(51.9, -8.47), pin(53.35, -6.26), pin(54.95, -7.73)], null);

    assert.deepEqual(view, { north: 54.95, south: 51.9, east: -6.26, west: -8.47 });
  });

  test("with a place, is centred on it and holds the nearest few homes, not the far ones", () => {
    const rathmines = { lat: 53.32, lng: -6.27 };
    const nearby = [pin(53.33, -6.26, 1300), pin(53.3, -6.28, 2300), pin(53.34, -6.3, 3000), pin(53.29, -6.24, 3900), pin(53.36, -6.27, 4400)];
    const cork = pin(51.9, -8.47, 220000);

    // In name order, as the API gives them, so the far one is not last.
    const view = firstView([cork, ...nearby], rathmines);

    const middle = centre(view);
    assert.ok(Math.abs(middle.lat - rathmines.lat) < 1e-9 && Math.abs(middle.lng - rathmines.lng) < 1e-9);
    for (const home of nearby) {
      assert.ok(home.latitude <= view.north && home.latitude >= view.south, "latitude in view");
      assert.ok(home.longitude <= view.east && home.longitude >= view.west, "longitude in view");
    }
    assert.ok(view.south > cork.latitude, "Cork is out of view");
  });

  test("is never closer in than a town: one pin, or pins on one street, still show their surroundings", () => {
    for (const pins of [[pin(53.35, -6.26)], [pin(53.35, -6.26), pin(53.3501, -6.2601)]]) {
      const view = firstView(pins, null);

      assert.ok(view.north - view.south >= 0.05, "a few kilometres from top to bottom");
      assert.ok(view.east - view.west >= 0.05, "and from side to side");
    }
  });
});

test("the place searched from is read from near, as the page address holds it", () => {
  assert.deepEqual(nearPoint("53.32,-6.27"), { lat: 53.32, lng: -6.27 });
  assert.equal(nearPoint(""), null);
});

describe("keeping a chosen home's card inside the map", () => {
  const map = { left: 0, top: 0, right: 800, bottom: 576 };

  test("a card that is all in view moves nothing", () => {
    assert.deepEqual(shiftInto({ left: 200, top: 100, right: 488, bottom: 260 }, map), { x: 0, y: 0 });
  });

  test("a card past an edge moves the view by what is cut off, and no further", () => {
    assert.deepEqual(shiftInto({ left: 600, top: -30, right: 888, bottom: 130 }, map), { x: 88, y: -30 });
    assert.deepEqual(shiftInto({ left: -40, top: 500, right: 248, bottom: 600 }, map), { x: -40, y: 24 });
  });
});
