// tests/amenity-icons.test.mjs
// The amenity pictures in lib/amenity-icons.ts (CCARE-225). They are keyed by the API's item names,
// so a renamed item would quietly lose its picture; these check every room type, activity and
// facility has one, and that no picture is keyed by a name the vocabulary doesn't have.
// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { AMENITY_ICON_PATHS, FACILITY_REUSES } from "../lib/amenity-icons.ts";
import { FILTER_GROUPS } from "../lib/search-filters.ts";

const items = (key) => FILTER_GROUPS.find((group) => group.key === key).options.map((option) => option.item);

test("every room type has a picture", () => {
  for (const item of items("room")) assert.ok(AMENITY_ICON_PATHS[item], `no picture for "${item}"`);
});

test("every activity has a picture", () => {
  for (const item of items("act")) assert.ok(AMENITY_ICON_PATHS[item], `no picture for "${item}"`);
});

test("every facility has a picture", () => {
  for (const item of items("fac")) assert.ok(AMENITY_ICON_PATHS[item], `no picture for "${item}"`);
});

test("a facility reuses only an activity's picture", () => {
  const activities = new Set(items("act"));
  for (const [facility, activity] of Object.entries(FACILITY_REUSES)) {
    assert.ok(items("fac").includes(facility), `"${facility}" is not a facility`);
    assert.ok(activities.has(activity), `"${activity}" is not an activity`);
  }
});

test("every picture belongs to an item in the vocabulary", () => {
  const known = new Set(FILTER_GROUPS.flatMap((group) => group.options.map((option) => option.item)));
  for (const item of Object.keys(AMENITY_ICON_PATHS)) assert.ok(known.has(item), `"${item}" is not an item`);
});

test("no two items share a picture, except a facility reusing its activity's", () => {
  const owner = new Map();
  for (const [item, { stroke, fill }] of Object.entries(AMENITY_ICON_PATHS)) {
    if (item in FACILITY_REUSES) continue;
    const drawing = `${stroke}|${fill}`;
    assert.ok(!owner.has(drawing), `"${item}" and "${owner.get(drawing)}" share a picture`);
    owner.set(drawing, item);
  }
});

test("no drawing has a malformed number, which stops a browser drawing the rest of the path", () => {
  for (const [item, { stroke, fill }] of Object.entries(AMENITY_ICON_PATHS)) {
    assert.doesNotMatch(`${stroke} ${fill}`, /--|NaN/, `"${item}"`);
  }
});
