// tests/town-boundaries.test.ts
// The towns' boundary files (public/town-boundaries/, CCARE-323), which the search page's map finds
// by the town's name alone (lib/town-boundaries.ts): there is one for every town with a landmark
// that the CSO has an area for, and each is that town. Then when the map draws a town's line: only
// while it reads as the town's shape.
// Run with: npm test
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { LANDMARKS } from "../lib/landmarks.ts";
import { townBoundaryFile, townLineReads } from "../lib/town-boundaries.ts";

const PUBLIC = new URL("../public", import.meta.url);

// The towns that have a file, each with its file's address on the site.
const TOWNS = LANDMARKS.flatMap((landmark) => {
  const file = townBoundaryFile(landmark.place);
  return file ? [{ ...landmark, file }] : [];
});

function boundary(file: string) {
  return JSON.parse(readFileSync(new URL(PUBLIC.href + file), "utf8"));
}

// Whether a point is inside a ring of [longitude, latitude] points: a line east from it crosses the
// ring an odd number of times.
function inside(latitude: number, longitude: number, ring: number[][]) {
  let crossings = 0;
  for (let i = 1; i < ring.length; i++) {
    const [x1, y1] = ring[i - 1];
    const [x2, y2] = ring[i];
    if (y1 > latitude !== y2 > latitude && longitude < x1 + ((x2 - x1) * (latitude - y1)) / (y2 - y1)) crossings++;
  }
  return crossings % 2 === 1;
}

// How far a point is from a ring's line, in kilometres. A degree is taken as the same length all
// over a town, which is right to a few metres.
function kmFrom(latitude: number, longitude: number, ring: number[][]) {
  const kmEast = 111.32 * Math.cos((latitude * Math.PI) / 180);
  const kmNorth = 110.57;
  let nearest = Infinity;
  for (let i = 1; i < ring.length; i++) {
    const [x1, y1] = [(ring[i - 1][0] - longitude) * kmEast, (ring[i - 1][1] - latitude) * kmNorth];
    const [x2, y2] = [(ring[i][0] - longitude) * kmEast, (ring[i][1] - latitude) * kmNorth];
    const lengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    // How far along the segment its nearest point is, from 0 at one end to 1 at the other.
    const along = lengthSquared ? Math.max(0, Math.min(1, -(x1 * (x2 - x1) + y1 * (y2 - y1)) / lengthSquared)) : 0;
    nearest = Math.min(nearest, Math.hypot(x1 + along * (x2 - x1), y1 + along * (y2 - y1)));
  }
  return nearest;
}

test("a town's file is named by the town's name, without a bracketed part or accents", () => {
  assert.equal(townBoundaryFile("Dublin City"), "/town-boundaries/dublin-city.json");
  assert.equal(townBoundaryFile("Dingle (Daingean Uí Chúis)"), "/town-boundaries/dingle.json");
  assert.equal(townBoundaryFile("Carrick-on-Shannon"), "/town-boundaries/carrick-on-shannon.json");
  assert.equal(townBoundaryFile("Laytown-Bettystown-Mornington-Donacarney"), "/town-boundaries/laytown-bettystown-mornington-donacarney.json");
});

test("Dún Laoghaire and Tallaght have no file: they are inside Dublin's area", () => {
  assert.equal(townBoundaryFile("Dún Laoghaire"), null);
  assert.equal(townBoundaryFile("Tallaght"), null);
});

test("there are 113 files: one for every other town, and none without a town", () => {
  const files = readdirSync(new URL(`${PUBLIC.href}/town-boundaries/`)).filter((name) => name.endsWith(".json"));

  assert.equal(files.length, 113);
  assert.deepEqual(files.map((name) => `/town-boundaries/${name}`).sort(), TOWNS.map((town) => town.file).sort());
});

test("each file is one feature, a Polygon or a MultiPolygon", () => {
  for (const town of TOWNS) {
    const { features } = boundary(town.file);

    assert.equal(features.length, 1, town.place);
    assert.ok(["Polygon", "MultiPolygon"].includes(features[0].geometry.type), town.place);
  }
});

test("each file is its own town: the town's landmark is inside it, or within 1 km of it", () => {
  for (const { place, file, latitude, longitude } of TOWNS) {
    const { geometry } = boundary(file).features[0];
    // Each part's first ring is its outline; the files have no holes.
    const outlines: number[][][] = geometry.type === "Polygon" ? [geometry.coordinates[0]] : geometry.coordinates.map((part: number[][][]) => part[0]);

    // A landmark can stand just outside the built-up area's edge, as Arklow's does.
    assert.ok(
      outlines.some((outline) => inside(latitude, longitude, outline) || kmFrom(latitude, longitude, outline) <= 1),
      `${place}'s landmark is in or beside ${file}`,
    );
  }
});

// The boxes four towns' lines fit in, from their files, and the search page's map on a wide screen.
const KILRUSH = { north: 52.6488, south: 52.62804, east: -9.4704, west: -9.50243 }; // 2 km across
const TRALEE = { north: 52.30036, south: 52.24837, east: -9.65396, west: -9.75388 }; // 7 km
const DUBLIN_CITY = { north: 53.43613, south: 53.21331, east: -6.04393, west: -6.47879 }; // 29 km
const NAVAN = { north: 53.67376, south: 53.62364, east: -6.64296, west: -6.71661 }; // 5.5 km
const WIDE_MAP = { width: 811, height: 810 };

test("a town's line is not drawn while it is a smudge under the pins", () => {
  // Kilrush's search opens at zoom 10, where the town is 25 pixels across. At zoom 13 it is 199.
  assert.equal(townLineReads(KILRUSH, 10, WIDE_MAP), false);
  assert.equal(townLineReads(KILRUSH, 13, WIDE_MAP), true);
});

test("a town's line is drawn while it reads as the town's shape", () => {
  assert.equal(townLineReads(TRALEE, 12, WIDE_MAP), true);
});

test("a town's line is not drawn while the view is inside it", () => {
  // Dublin City's search opens at zoom 13, where the line is three times as wide as the map. A
  // step out it is still half as wide again, and two steps out it fits.
  assert.equal(townLineReads(DUBLIN_CITY, 13, WIDE_MAP), false);
  assert.equal(townLineReads(DUBLIN_CITY, 12, WIDE_MAP), false);
  assert.equal(townLineReads(DUBLIN_CITY, 11, WIDE_MAP), true);
});

test("the map's longer side is what counts, so a phone held upright counts its height", () => {
  // Navan at zoom 13 is 493 pixels down: more than a phone map's width of 343, and within its 568.
  assert.equal(townLineReads(NAVAN, 13, { width: 343, height: 568 }), true);
  assert.equal(townLineReads(NAVAN, 14, { width: 343, height: 568 }), false);
});
