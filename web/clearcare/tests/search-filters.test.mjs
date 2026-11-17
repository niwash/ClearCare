// tests/search-filters.test.mjs
// The search page's care and amenity filters in lib/search-filters.ts (CCARE-189): reading them from
// the page address, writing them back, what goes to the API, and the ticks on a result. Node strips
// the file's types, so it is loaded as it is. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeFilters,
  apiFilterParams,
  CARE_GROUPS,
  filterCount,
  FILTER_GROUPS,
  matchedLabels,
  MORE_GROUPS,
  NO_FILTERS,
  readSelection,
  selectionParams,
  toggled,
  withoutGroups,
} from "../lib/search-filters.ts";

test("reads comma-joined and repeated values, in the options' order, and drops unknown slugs", () => {
  const selection = readSelection({ care: "respite,dementia", room: ["single", "twin"], fac: "garden,moat" });
  assert.deepEqual(selection, { care: ["dementia", "respite"], room: ["single", "twin"], fac: ["garden"], act: [] });
});

test("an old link's fairdeal=1 is ignored, so nothing the API would reject is sent", () => {
  const selection = readSelection({ care: "dementia", fairdeal: "1" });
  assert.deepEqual(selection, { ...NO_FILTERS, care: ["dementia"] });
  assert.equal(apiFilterParams(selection).has("fair_deal"), false);
});

test("a selection survives the page address", () => {
  const selection = { care: ["long-term", "palliative"], room: ["en-suite"], fac: [], act: ["music"] };
  const params = Object.fromEntries(selectionParams(selection));
  assert.deepEqual(params, { care: "long-term,palliative", room: "en-suite", act: "music" });
  assert.deepEqual(readSelection(params), selection);
});

test("no filters leave the page address empty", () => {
  assert.equal(selectionParams(NO_FILTERS).toString(), "");
});

test("the API gets one parameter per ticked item, by its v2 name", () => {
  const params = apiFilterParams({ care: ["dementia", "respite"], room: ["twin"], fac: ["cafe"], act: [] });
  assert.deepEqual(params.getAll("care_type"), ["Dementia care", "Respite care"]);
  assert.deepEqual(params.getAll("room_type"), ["Twin/double room"]);
  assert.deepEqual(params.getAll("facility"), ["Café/coffee dock"]);
  assert.equal(params.has("activity"), false);
});

test("every option has a unique slug in its group and an item", () => {
  for (const group of FILTER_GROUPS) {
    const slugs = group.options.map((option) => option.slug);
    assert.equal(new Set(slugs).size, slugs.length, group.key);
    for (const option of group.options) assert.ok(option.item && option.label, option.slug);
  }
});

test("every v2 item is offered once: 18 care types, 6 room types, 34 facilities, 35 activities", () => {
  const sizes = Object.fromEntries(FILTER_GROUPS.map((group) => [group.key, new Set(group.options.map((option) => option.item)).size]));
  assert.deepEqual(sizes, { care: 18, room: 6, fac: 34, act: 35 });
  for (const group of FILTER_GROUPS) assert.equal(new Set(group.options.map((option) => option.item)).size, group.options.length, group.key);
});

test("toggling ticks and unticks, keeping the options' order", () => {
  const ticked = toggled(toggled(NO_FILTERS, "care", "respite"), "care", "dementia");
  assert.deepEqual(ticked.care, ["dementia", "respite"]);
  assert.deepEqual(toggled(ticked, "care", "dementia").care, ["respite"]);
});

test("counts and lists the active filters, each with the selection without it", () => {
  const selection = { care: ["dementia"], room: [], fac: ["garden"], act: [] };
  assert.equal(filterCount(selection), 2);
  const active = activeFilters(selection);
  assert.deepEqual(active.map((filter) => filter.label), ["Dementia care", "Garden"]);
  assert.deepEqual(active[0].without.care, []);
  assert.deepEqual(active[1].without.fac, []);
});

test("the bar's two panels hold every group between them: the care types, and the rest", () => {
  assert.deepEqual(CARE_GROUPS.map((group) => group.key), ["care"]);
  assert.deepEqual(MORE_GROUPS.map((group) => group.key), ["room", "fac", "act"]);
});

test("a panel counts and clears the options ticked in its own groups", () => {
  const selection = { care: ["dementia"], room: ["single", "twin"], fac: ["garden"], act: [] };
  assert.equal(filterCount(selection, CARE_GROUPS), 1);
  assert.equal(filterCount(selection, MORE_GROUPS), 3);
  assert.deepEqual(withoutGroups(selection, MORE_GROUPS), { ...NO_FILTERS, care: ["dementia"] });
  assert.deepEqual(withoutGroups(selection, CARE_GROUPS), { ...selection, care: [] });
});

test("a result is ticked only for the chosen options it has", () => {
  const selection = { care: ["dementia"], room: ["single", "twin"], fac: ["garden"], act: [] };
  const amenities = { care_types: ["Dementia care"], room_types: ["Twin/double room"], facilities: [], activities: [] };
  assert.deepEqual(matchedLabels(selection, amenities), ["Dementia care", "Twin / double room"]);
  assert.deepEqual(matchedLabels(selection, null), []);
});
