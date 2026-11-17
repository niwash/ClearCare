// tests/map-clusters.test.ts
// What the search page's map draws at a zoom (lib/map-clusters.ts): a pin for a home on its own, and
// one cluster with a count where pins would pile up; and which of them a home in the list marks.
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { clusterIndex, markOf, marksIn, opensAt } from "../lib/map-clusters.ts";
import type { CentrePoint, MapBounds } from "../lib/search-map.ts";

function home(centre_id: string, latitude: number, longitude: number): CentrePoint {
  return { centre_id, centre_name: `Home ${centre_id}`, address: "Main Street", county: "Dublin", latitude, longitude, distance_m: null };
}

const IRELAND: MapBounds = { north: 55.5, south: 51.3, east: -5.4, west: -10.7 };
const COUNTRY_ZOOM = 7;
const STREET_ZOOM = 17;

// Two homes about 80 m apart in Rathmines, and one in Cork.
const rathmines = [home("a", 53.3219, -6.2655), home("b", 53.3224, -6.2646)];
const cork = home("c", 51.8985, -8.4756);

describe("what the map draws", () => {
  test("homes a street apart are one cluster from far out, and a pin each up close", () => {
    const index = clusterIndex([...rathmines, cork]);

    const far = marksIn(index, IRELAND, COUNTRY_ZOOM);
    assert.deepEqual(far.pins, [cork]);
    assert.equal(far.clusters.length, 1);
    assert.equal(far.clusters[0].count, 2);

    const close = marksIn(index, IRELAND, STREET_ZOOM);
    assert.deepEqual(close.clusters, []);
    assert.deepEqual(new Set(close.pins), new Set([...rathmines, cork]));
  });

  test("every home is drawn once, as a pin or in a cluster's count", () => {
    // 120 homes within about 25 km of Dublin, as the register has, and one in Cork.
    const dublin = Array.from({ length: 120 }, (_, i) => home(`d${i}`, 53.35 + 0.2 * Math.sin(i * 7), -6.26 + 0.3 * Math.cos(i * 11)));
    const index = clusterIndex([...dublin, cork]);

    for (const zoom of [COUNTRY_ZOOM, 10, 13, STREET_ZOOM]) {
      const { pins, clusters } = marksIn(index, IRELAND, zoom);
      assert.equal(pins.length + clusters.reduce((sum, cluster) => sum + cluster.count, 0), 121, `at zoom ${zoom}`);
    }
    const country = marksIn(index, IRELAND, COUNTRY_ZOOM);
    assert.ok(country.pins.length + country.clusters.length < 10, "Dublin is a few clusters on the country's map, not 120 pins");
  });

  test("a zoom between two levels draws as the level below it", () => {
    const index = clusterIndex(rathmines);

    assert.deepEqual(marksIn(index, IRELAND, COUNTRY_ZOOM + 0.6), marksIn(index, IRELAND, COUNTRY_ZOOM));
  });

  test("only what is in view is drawn, with what is just past its edges", () => {
    const index = clusterIndex([...rathmines, cork]);
    const dublin: MapBounds = { north: 53.4, south: 53.3, east: -6.2, west: -6.35 };
    const pastTheEdge: MapBounds = { ...dublin, south: 53.323 };

    assert.deepEqual(new Set(marksIn(index, dublin, STREET_ZOOM).pins), new Set(rathmines));
    assert.deepEqual(new Set(marksIn(index, pastTheEdge, STREET_ZOOM).pins), new Set(rathmines));
  });

  test("a chosen cluster opens at a zoom where its homes come apart", () => {
    // Three homes in a line, each some 4 km from the next: one cluster at zoom 10. On a short map,
    // a view fitted to them with space round it stays at zoom 10, and shows the same cluster again.
    const line = [home("x", 53.32, -6.26), home("y", 53.355, -6.26), home("z", 53.285, -6.26)];
    const index = clusterIndex(line);
    const [cluster] = marksIn(index, IRELAND, 10).clusters;
    assert.equal(cluster.count, 3);

    const zoom = opensAt(index, cluster);

    assert.ok(zoom > 10);
    const opened = marksIn(index, IRELAND, zoom);
    assert.ok(opened.pins.length + opened.clusters.length > 1, "more than the one cluster");
  });

  test("homes a street apart come apart only at the closest zooms", () => {
    const index = clusterIndex(rathmines);
    const [cluster] = marksIn(index, IRELAND, COUNTRY_ZOOM).clusters;

    assert.deepEqual(new Set(marksIn(index, IRELAND, opensAt(index, cluster)).pins), new Set(rathmines));
  });
});

describe("the mark of a home in the list", () => {
  const index = clusterIndex([...rathmines, cork]);

  test("is its own pin where it is drawn apart", () => {
    const close = marksIn(index, IRELAND, STREET_ZOOM);

    assert.equal(markOf(index, close, "a"), rathmines[0]);
    assert.equal(markOf(index, close, "c"), cork);
  });

  test("is the cluster that holds it where it is not", () => {
    const far = marksIn(index, IRELAND, COUNTRY_ZOOM);

    assert.equal(markOf(index, far, "a"), far.clusters[0]);
    assert.equal(markOf(index, far, "b"), far.clusters[0]);
    assert.equal(markOf(index, far, "c"), cork);
  });

  test("is nothing for a home out of view, or with no point", () => {
    const dublin: MapBounds = { north: 53.4, south: 53.3, east: -6.2, west: -6.35 };

    assert.equal(markOf(index, marksIn(index, dublin, STREET_ZOOM), "c"), null);
    assert.equal(markOf(index, marksIn(index, IRELAND, COUNTRY_ZOOM), "no-point"), null);
  });
});
