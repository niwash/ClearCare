// tests/county-boxes.test.ts
// The counties' boxes (lib/county-boxes.ts) against the boundary files they were made from
// (public/county-boundaries/), so the table is made again when a file changes.
// Run with: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { COUNTIES } from "../lib/counties.ts";
import { countyBox } from "../lib/county-boxes.ts";
import { countySlug } from "../lib/home-address.ts";

// Every point of a county's boundary, as [longitude, latitude].
function boundaryPoints(county: string): number[][] {
  const file = new URL(`../public/county-boundaries/${countySlug(county)}.json`, import.meta.url);
  const { geometry } = JSON.parse(readFileSync(file, "utf8")).features[0];
  const parts: number[][][][] = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return parts.flat(2);
}

test("every county has a box that holds its boundary, and is no more than its rounding wider", () => {
  for (const county of COUNTIES) {
    const box = countyBox(county);
    assert.ok(box, `${county} has a box`);
    const points = boundaryPoints(county);
    const longitudes = points.map(([longitude]) => longitude);
    const latitudes = points.map(([, latitude]) => latitude);
    const edges = { north: Math.max(...latitudes), south: Math.min(...latitudes), east: Math.max(...longitudes), west: Math.min(...longitudes) };

    assert.ok(box.north >= edges.north && box.south <= edges.south && box.east >= edges.east && box.west <= edges.west, `${county}'s box holds its boundary`);
    for (const edge of ["north", "south", "east", "west"] as const) {
      assert.ok(Math.abs(box[edge] - edges[edge]) < 0.001, `${county}'s ${edge} edge is the boundary's, to 3 decimals`);
    }
  }
});

test("a county the site doesn't know has no box", () => {
  assert.equal(countyBox(""), null);
  assert.equal(countyBox("Atlantis"), null);
  assert.equal(countyBox("constructor"), null);
});
