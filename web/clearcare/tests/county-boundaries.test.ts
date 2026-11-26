// tests/county-boundaries.test.ts
// The counties' boundary files (public/county-boundaries/, CCARE-319), which the search page's map
// draws by the county's name alone: there is one for every county, and each is that county.
// Run with: npm test
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { COUNTIES } from "../lib/counties.ts";
import { countySlug } from "../lib/home-address.ts";

const FILES = new URL("../public/county-boundaries/", import.meta.url);

function boundary(county: string) {
  return JSON.parse(readFileSync(new URL(`${countySlug(county)}.json`, FILES), "utf8"));
}

// A town well inside each county, as [latitude, longitude]: the county town, or another where that
// one is on the coast or on the county's edge, as Carrick-on-Shannon and Clonmel are.
const TOWNS: Record<string, [string, number, number]> = {
  Carlow: ["Tullow", 52.801, -6.737],
  Cavan: ["Cavan", 53.991, -7.361],
  Clare: ["Ennis", 52.844, -8.986],
  Cork: ["Cork", 51.899, -8.476],
  Donegal: ["Letterkenny", 54.956, -7.734],
  Dublin: ["Dublin", 53.349, -6.26],
  Galway: ["Tuam", 53.514, -8.856],
  Kerry: ["Tralee", 52.271, -9.7],
  Kildare: ["Naas", 53.221, -6.659],
  Kilkenny: ["Kilkenny", 52.654, -7.245],
  Laois: ["Portlaoise", 53.034, -7.3],
  Leitrim: ["Manorhamilton", 54.305, -8.176],
  Limerick: ["Limerick", 52.664, -8.627],
  Longford: ["Longford", 53.728, -7.793],
  Louth: ["Ardee", 53.858, -6.54],
  Mayo: ["Castlebar", 53.855, -9.288],
  Meath: ["Navan", 53.653, -6.681],
  Monaghan: ["Monaghan", 54.249, -6.968],
  Offaly: ["Tullamore", 53.274, -7.489],
  Roscommon: ["Roscommon", 53.628, -8.189],
  Sligo: ["Tubbercurry", 54.055, -8.73],
  Tipperary: ["Thurles", 52.682, -7.802],
  Waterford: ["Lismore", 52.137, -7.931],
  Westmeath: ["Mullingar", 53.526, -7.338],
  Wexford: ["Enniscorthy", 52.502, -6.566],
  Wicklow: ["Rathdrum", 52.933, -6.23],
};

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

test("every county has a boundary file, and there is no file without a county", () => {
  const files = readdirSync(FILES).filter((name) => name.endsWith(".json"));

  assert.deepEqual(files.sort(), COUNTIES.map((county) => `${countySlug(county)}.json`).sort());
});

test("each file is one feature, a Polygon or a MultiPolygon", () => {
  for (const county of COUNTIES) {
    const { features } = boundary(county);

    assert.equal(features.length, 1, county);
    assert.ok(["Polygon", "MultiPolygon"].includes(features[0].geometry.type), county);
  }
});

test("each file is its own county: a town of the county is inside it", () => {
  for (const county of COUNTIES) {
    const [town, latitude, longitude] = TOWNS[county];
    const { geometry } = boundary(county).features[0];
    // Each part's first ring is its outline; the files have no holes.
    const outlines: number[][][] = geometry.type === "Polygon" ? [geometry.coordinates[0]] : geometry.coordinates.map((part: number[][][]) => part[0]);

    assert.ok(outlines.some((outline) => inside(latitude, longitude, outline)), `${town} is in ${county}`);
  }
});
