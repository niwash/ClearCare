// lib/place-search.ts
// Google is behind the functions passed in, so the tests load this file as it is, with its imports
// named with their extension.
import { countyNamed } from "./counties.ts";
import { asEircode } from "./eircode.ts";
import type { PageSearch } from "./page-search.ts";
import type { SortValue } from "./search-filters.ts";

type PlaceFields = Pick<PageSearch, "place" | "near" | "county" | "sort">;

// One of Google's suggestions, as the search uses it.
export interface PlaceSuggestion {
  label: string; // what goes in the box, and in the results heading: "Rathmines, Dublin"
  county: string | null; // the county it is, as the API spells it, or null for a town, area or Eircode
  locate: () => Promise<string>; // asks Google where it is: its near, or "" when Google can't say
}

// A picked place whose location Google hasn't given yet.
export interface PendingPick {
  label: string;
  near: Promise<string>;
}

// A suggestion's two lines, as Google gives them: "Rathmines" and "Dublin, Ireland".
export function readSuggestion(text: { mainText: string; secondaryText: string }): Omit<PlaceSuggestion, "locate"> {
  // Every suggestion is in Ireland (includedRegionCodes), so the country says nothing.
  const where = text.secondaryText.replace(/(^|,\s*)Ireland$/, "");
  // By name rather than by type: administrative_area_level_2 is also Cork City, and a Roscommon
  // inside County Roscommon.
  const county = text.mainText.startsWith("County ") ? countyNamed(text.mainText) : null;
  return { label: [text.mainText, where].filter(Boolean).join(", "), county };
}

// Whether text could go to Google: two characters at least, and not a routing key alone ("D6W",
// "A98"), which keeps the Eircode filter it has always had rather than becoming one point.
export function asksGoogle(text: string) {
  const trimmed = text.trim();
  return trimmed.length >= 2 && asEircode(trimmed)?.length !== 3;
}

// Whether Search must ask Google about the box's text first: it wasn't picked, and the page hasn't
// already searched it as text after Google had nothing to say. While it does, the button can't show
// a count, which would be for the wrong search.
export function needsLookup(draft: PlaceFields, searched: Pick<PageSearch, "place" | "near">) {
  const searchedAsText = !searched.near && draft.place === searched.place;
  return !draft.near && !searchedAsText && asksGoogle(draft.place);
}

export function withoutDistance(sort: SortValue): SortValue {
  return sort === "distance" ? "name" : sort;
}

export function pickedCounty<T extends PlaceFields>(draft: T, county: string): T {
  return { ...draft, county, place: "", near: "", sort: withoutDistance(draft.sort) };
}

export function pickedPlace<T extends PlaceFields>(draft: T, label: string, near: string): T {
  return { ...draft, place: label, near, sort: "distance" };
}

export function typedPlace<T extends PlaceFields>(draft: T, text: string): T {
  return { ...draft, place: text, near: "", sort: withoutDistance(draft.sort) };
}

export function usedLocation<T extends PlaceFields>(draft: T, near: string): T {
  return { ...draft, place: "", near, sort: "distance" };
}

// What a promise gives before the deadline, or null after it or when it fails.
function before<V>(deadline: Promise<unknown>, answer: Promise<V>): Promise<V | null> {
  return Promise.race([answer.catch(() => null), deadline.then(() => null)]);
}

// The draft as Search sends it: a pick still asking Google where it is waited for, and text that
// wasn't picked replaced by Google's first suggestion for it, exactly as if it had been picked.
// findFirst is null when Google isn't in use (no key, nothing typed in the box, or it failed to load).
// Past the deadline, or when Google fails or has no suggestion, the text is searched as it is.
export async function settlePlace<T extends PlaceFields>(
  draft: T,
  lookup: {
    searched: Pick<PageSearch, "place" | "near">; // the search the page shows
    pick: PendingPick | null;
    findFirst: ((text: string) => Promise<PlaceSuggestion | null>) | null;
    deadline: Promise<unknown>;
  },
): Promise<T> {
  const { pick, findFirst, deadline } = lookup;
  if (pick && pick.label === draft.place && !draft.near) {
    const near = await before(deadline, pick.near);
    return near ? pickedPlace(draft, pick.label, near) : draft;
  }
  if (!findFirst || !needsLookup(draft, lookup.searched)) return draft;

  const suggestion = await before(deadline, findFirst(draft.place.trim()));
  if (!suggestion) return draft;
  if (suggestion.county) return pickedCounty(draft, suggestion.county);
  const near = await before(deadline, suggestion.locate());
  return near ? pickedPlace(draft, suggestion.label, near) : draft;
}
