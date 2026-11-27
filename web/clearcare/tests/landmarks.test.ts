// tests/landmarks.test.ts
// The towns' landmarks (lib/landmarks.ts, CCARE-322): the table against the research it is taken
// from, which of Google's suggestions is one of the towns, and which search is made from a landmark.
// Google's points are the ones it gave on 27 November 2026.
// Run with: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { LANDMARKS, landmarkNamed, searchLandmark } from "../lib/landmarks.ts";

// The research's rows: a table under a heading for each county, in a file for each province.
function research() {
  const rows = [];
  for (const province of ["leinster", "munster", "connacht", "ulster-roi"]) {
    const file = new URL(`../../../Research/City Landmarks/${province}.md`, import.meta.url);
    let county = "";
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      county = line.match(/^## Co\. (.+)$/)?.[1] ?? county;
      const cells = line.split("|").map((cell) => cell.trim());
      // A table's row for a town has a number where its heading and the line under it have none.
      if (!line.startsWith("|") || !Number(cells[4])) continue;
      rows.push({ place: cells[1], county, landmark: cells[3], latitude: Number(cells[4]), longitude: Number(cells[5]) });
    }
  }
  return rows;
}

test("the table is the research's: its 115 towns, each with its county, landmark and coordinates", () => {
  const table = LANDMARKS.map(({ place, county, landmark, latitude, longitude }) => ({ place, county, landmark, latitude, longitude }));
  assert.equal(table.length, 115);
  assert.deepEqual(table, research());
});

test("every town is found by each of its names, so no two towns share one", () => {
  for (const landmark of LANDMARKS) {
    for (const name of [landmark.place, ...(landmark.otherNames ?? [])]) {
      assert.equal(landmarkNamed(name, landmark.latitude, landmark.longitude), landmark, name);
    }
  }
});

test("each of Google's suggestions for a town is the town, wherever Google puts it", () => {
  // "Dublin City, County Dublin" is in the Phoenix Park, and "Dublin" is on O'Connell Street.
  assert.equal(landmarkNamed("Dublin City", 53.3603142, -6.3150542)?.landmark, "General Post Office (GPO), O'Connell Street");
  assert.equal(landmarkNamed("Dublin", 53.3498053, -6.2603097)?.landmark, "General Post Office (GPO), O'Connell Street");
});

test("a town's name is the same with or without City or Town, capitals and accents", () => {
  assert.equal(landmarkNamed("Kilkenny", 52.6549027, -7.2464029)?.place, "Kilkenny City");
  assert.equal(landmarkNamed("Donegal", 54.653827, -8.1096142)?.place, "Donegal Town");
  assert.equal(landmarkNamed("Carrick-On-Shannon", 53.9450799, -8.0865156)?.place, "Carrick-on-Shannon");
  assert.equal(landmarkNamed("Dun Laoghaire", 53.2949656, -6.142669)?.place, "Dún Laoghaire");
});

test("a town is also found by the other names Google has for it", () => {
  assert.equal(landmarkNamed("Bettystown", 53.698547, -6.2452034)?.place, "Laytown-Bettystown-Mornington-Donacarney");
  assert.equal(landmarkNamed("Daingean Uí Chúis", 52.1408534, -10.2671142)?.place, "Dingle (Daingean Uí Chúis)");
});

test("a place of the same name somewhere else is not the town", () => {
  // Kilrush in Co. Tipperary, 126 km from Kilrush in Co. Clare, and Ballinasloe in Co. Roscommon,
  // 14 km from Ballinasloe in Co. Galway.
  assert.equal(landmarkNamed("Kilrush", 52.66765, -7.60957), null);
  assert.equal(landmarkNamed("Ballinasloe", 53.4564434, -8.2474861), null);
});

test("a place beside a landmark is not its town without the town's name", () => {
  // Rathmines is 3 km from the GPO, and Laytown is a place of its own in the town Bettystown is in.
  assert.equal(landmarkNamed("Rathmines", 53.32, -6.27), null);
  assert.equal(landmarkNamed("Laytown", 53.6853371, -6.2411643), null);
});

test("a search is from a landmark when its place has the town's name and its point is the landmark's, rounded", () => {
  assert.equal(searchLandmark({ place: "Dublin City, County Dublin", near: "53.35,-6.26" })?.landmark, "General Post Office (GPO), O'Connell Street");
  assert.equal(searchLandmark({ place: "Dublin", near: "53.35,-6.26" })?.landmark, "General Post Office (GPO), O'Connell Street");
  assert.equal(searchLandmark({ place: "Kilrush, County Clare", near: "52.64,-9.48" })?.place, "Kilrush");
});

test("any other search is from no landmark", () => {
  // Another place, an Eircode and the visitor's own location, which has no name.
  assert.equal(searchLandmark({ place: "Rathmines, Dublin", near: "53.32,-6.27" }), null);
  assert.equal(searchLandmark({ place: "D01 F5P2", near: "53.35,-6.26" }), null);
  assert.equal(searchLandmark({ place: "", near: "53.35,-6.26" }), null);
  // A link from before the landmarks, with Google's own point for "Dublin City, County Dublin".
  assert.equal(searchLandmark({ place: "Dublin City, County Dublin", near: "53.36,-6.32" }), null);
  // A town's name with no point: text that was searched as an address.
  assert.equal(searchLandmark({ place: "Dublin", near: "" }), null);
});
