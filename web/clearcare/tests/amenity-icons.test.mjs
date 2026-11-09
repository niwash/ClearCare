// tests/amenity-icons.test.mjs
// The amenity pictures in lib/amenity-icons.ts (CCARE-225). They are keyed by the API's item names,
// so a renamed item would quietly lose its picture; these check every room type has one, and that
// no picture is keyed by a name the vocabulary doesn't have. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { AMENITY_ICON_PATHS } from "../lib/amenity-icons.ts";
import { FILTER_GROUPS } from "../lib/search-filters.ts";

const items = (key) => FILTER_GROUPS.find((group) => group.key === key).options.map((option) => option.item);

test("every room type has a picture", () => {
  for (const item of items("room")) assert.ok(AMENITY_ICON_PATHS[item], `no picture for "${item}"`);
});

test("every picture belongs to an item in the vocabulary", () => {
  const known = new Set(FILTER_GROUPS.flatMap((group) => group.options.map((option) => option.item)));
  for (const item of Object.keys(AMENITY_ICON_PATHS)) assert.ok(known.has(item), `"${item}" is not an item`);
});

test("no two items share a picture", () => {
  const drawings = Object.values(AMENITY_ICON_PATHS).map(({ stroke, fill }) => `${stroke}|${fill}`);
  assert.equal(new Set(drawings).size, drawings.length);
});

test("no drawing has a malformed number, which stops a browser drawing the rest of the path", () => {
  for (const [item, { stroke, fill }] of Object.entries(AMENITY_ICON_PATHS)) {
    assert.doesNotMatch(`${stroke} ${fill}`, /--|NaN/, `"${item}"`);
  }
});
