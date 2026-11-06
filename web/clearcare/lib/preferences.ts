// lib/preferences.ts
// The search a signed-in visitor asked the site to remember (ADR-0025): the county, the order and
// the ticked care and amenity options, so they come back on a later visit without being ticked
// again. The name and place a visitor typed are not kept: they name one search, not a standing
// choice.
//
// It is one document, stored by the API as it is given. Everything that decides what may be in it
// lives here, so both the page and the route that saves it ask the same question: a county the
// register does not have, an option the site no longer offers or an order it does not show is
// dropped rather than stored, and an old saved search still opens as the search it can still make.
//
// Only type imports from lib/search-filters and constants from lib/counties, both named with their
// extension: the tests load this file as it is (tests/preferences.test.ts), and lib/search.ts reads
// the API (next/server), so it cannot be one of them.
import { COUNTIES } from "./counties.ts";
import {
  FILTER_GROUPS,
  NO_FILTERS,
  selectionParams,
  SORTS,
  type FilterSelection,
  type SortValue,
} from "./search-filters.ts";

/** The search the site remembers: what the filters can say, without the words typed in. */
export interface SavedSearch {
  county: string; // "" for any county
  sort: SortValue;
  selection: FilterSelection;
}

/**
 * The same search in the shape the API stores it (PUT /preferences, api/openapi.yaml). The keys are
 * the ones the saved document uses — the four list names the centres carry (`care_types`,
 * `room_types`, `facilities`, `activities`, as in lib/search-filters.ts) plus `sort_by` and
 * `county` — so a stored preference reads the same way as the data it searches.
 */
export interface SavedSearchDocument {
  county: string | null;
  care_types: string[];
  room_types: string[];
  facilities: string[];
  activities: string[];
  sort_by: SortValue;
}

export const NO_SAVED_SEARCH: SavedSearch = { county: "", sort: "name", selection: NO_FILTERS };

// Whether there is a choice in here worth keeping. A search by name, or by an Eircode, leaves
// nothing behind, and neither does one whose only order is the default.
export function hasSavedChoices(saved: SavedSearch) {
  return saved.county !== "" || saved.sort !== "name" || FILTER_GROUPS.some((group) => saved.selection[group.key].length > 0);
}

// The part of a search worth remembering, taken from the applied one.
export function savedSearchFrom(search: Pick<SavedSearch, "county" | "sort" | "selection">): SavedSearch {
  return { county: search.county, sort: search.sort, selection: search.selection };
}

export function savedSearchDocument(saved: SavedSearch): SavedSearchDocument {
  return {
    county: saved.county || null,
    care_types: saved.selection.care,
    room_types: saved.selection.room,
    facilities: saved.selection.fac,
    activities: saved.selection.act,
    sort_by: saved.sort,
  };
}

// The order the site offers, or the default.
function readSort(value: unknown): SortValue {
  return SORTS.some((option) => option.value === value) ? (value as SortValue) : "name";
}

// A county the register has, or "any county".
function readCounty(value: unknown) {
  return typeof value === "string" && COUNTIES.includes(value) ? value : "";
}

// The options a group offers, in the order it shows them. Unknown slugs are dropped, as the page
// address does (readSelection): a saved search from before an option was retired still opens.
function readGroup(key: keyof FilterSelection, value: unknown): string[] {
  const group = FILTER_GROUPS.find((candidate) => candidate.key === key)!;
  const picked = new Set(Array.isArray(value) ? value.filter((slug) => typeof slug === "string") : []);
  return group.options.filter((option) => picked.has(option.slug)).map((option) => option.slug);
}

// A saved search from the API's answer, or from text it said was one. Anything that is not an
// object with the right fields is no saved search at all, rather than an error on a page that only
// wanted to show a link.
export function parseSavedSearch(value: unknown): SavedSearch | null {
  if (typeof value !== "object" || value === null) return null;
  const document = value as Partial<SavedSearchDocument>;

  return {
    county: readCounty(document.county),
    sort: readSort(document.sort_by),
    selection: {
      care: readGroup("care", document.care_types),
      room: readGroup("room", document.room_types),
      fac: readGroup("fac", document.facilities),
      act: readGroup("act", document.activities),
    },
  };
}

export function sameSavedSearch(one: SavedSearch, other: SavedSearch) {
  if (one.county !== other.county || one.sort !== other.sort) return false;
  return FILTER_GROUPS.every((group) => one.selection[group.key].join() === other.selection[group.key].join());
}

// The page address of a saved search: ?county=Cork&care=dementia&sort=latest_inspection. Built here
// rather than with searchHref (lib/search.ts), which a test cannot load.
export function savedSearchHref(saved: SavedSearch) {
  const params = new URLSearchParams();
  if (saved.county) params.set("county", saved.county);
  for (const [key, value] of selectionParams(saved.selection)) params.set(key, value);
  if (saved.sort !== "name") params.set("sort", saved.sort);
  const text = params.toString();
  return text ? `/search?${text}` : "/search";
}
