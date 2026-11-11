// lib/search-box.ts
// What the search box does to a search (CCARE-230): one box for a home's name, a town, an area or an
// Eircode. Text typed there is held as the place until Search settles what it is (settleBox), the
// same rule for the search page's box and the home page's. Google and the homes' names are behind
// the functions passed in, so the tests load this file as it is, with its imports named with their
// extension.
import { countyNamed } from "./counties.ts";
import { asEircode } from "./eircode.ts";
import type { PageSearch } from "./page-search.ts";
import type { SortValue } from "./search-filters.ts";

type BoxFields = Pick<PageSearch, "name" | "place" | "near" | "county" | "sort">;

// One of Google's suggestions, as the search uses it.
export interface PlaceSuggestion {
  main: string; // the place's own name, Google's main text: "Rathmines"
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
  return { main: text.mainText, label: [text.mainText, where].filter(Boolean).join(", "), county };
}

// A routing key alone ("D6W", "A98"), which keeps the Eircode filter it has always had rather than
// becoming one point.
function isRoutingKey(text: string) {
  return asEircode(text)?.length === 3;
}

// Whether text could go to Google: two characters at least, and not a routing key alone.
export function asksGoogle(text: string) {
  const trimmed = text.trim();
  return trimmed.length >= 2 && !isRoutingKey(trimmed);
}

// What the box shows: the name searched for, or the place. A search made in the box never has
// both; a link can, and its place is then said under the box.
export function boxText(search: Pick<PageSearch, "name" | "place">) {
  return search.name || search.place;
}

// Whether Search must settle the box's text first: it is text typed there, which is held as the
// place with no name; it wasn't picked, it isn't a routing key, and it isn't what the page's box
// already showed, searched as it is. While it must, the button can't show a count, which would be
// for the wrong search.
export function needsLookup(draft: BoxFields, searched: Pick<PageSearch, "name" | "place" | "near">) {
  const text = draft.place.trim();
  const searchedAsItIs = !searched.near && boxText(searched) === draft.place;
  return text !== "" && !draft.name && !draft.near && !searchedAsItIs && !isRoutingKey(text);
}

export function withoutDistance(sort: SortValue): SortValue {
  return sort === "distance" ? "name" : sort;
}

export function withoutPlace<T extends BoxFields>(draft: T): T {
  return { ...draft, place: "", near: "", sort: withoutDistance(draft.sort) };
}

// Typing replaces whatever the box showed, a name or a place, with its point.
export function typedText<T extends BoxFields>(draft: T, text: string): T {
  return { ...withoutPlace(draft), name: "", place: text };
}

// What editing the box makes of the draft. Text that is what the page's box showed, again after a
// letter typed and deleted, or still in a form sent without scripts, goes on as the search it was:
// a name stays a name, and a place keeps its point. Anything else is typed over it.
export function editedText<T extends BoxFields>(draft: T, text: string, searched: Omit<BoxFields, "county">): T {
  if (text !== boxText(searched)) return typedText(draft, text);
  return { ...draft, name: searched.name, place: searched.place, near: searched.near, sort: searched.sort };
}

export function pickedName<T extends BoxFields>(draft: T, name: string): T {
  return { ...draft, name, place: "" };
}

export function pickedCounty<T extends BoxFields>(draft: T, county: string): T {
  return { ...withoutPlace(draft), county };
}

export function pickedPlace<T extends BoxFields>(draft: T, label: string, near: string): T {
  return { ...draft, place: label, near, sort: "distance" };
}

export function usedLocation<T extends BoxFields>(draft: T, near: string): T {
  return { ...draft, place: "", near, sort: "distance" };
}

// What a promise gives before the deadline, or null after it or when it fails.
function before<V>(deadline: Promise<unknown>, answer: Promise<V>): Promise<V | null> {
  return Promise.race([answer.catch(() => null), deadline.then(() => null)]);
}

// What Search can ask while it settles the box's text.
interface Lookup {
  searched: Pick<PageSearch, "name" | "place" | "near">; // the search the page shows
  pick: PendingPick | null;
  hasName: (text: string) => Promise<boolean>; // whether any home's name matches
  // Google's first suggestion; null when Google isn't in use (no key, nothing typed in the box, or
  // it failed to load).
  findFirst: ((text: string) => Promise<PlaceSuggestion | null>) | null;
  deadline: Promise<unknown>;
}

// On the server there is no Google, so text that is no county and no Eircode ends as a name whether
// or not a home has it, and the names needn't be asked either.
export const NOBODY_TO_ASK: Omit<Lookup, "searched"> = {
  pick: null,
  hasName: async () => false,
  findFirst: null,
  deadline: new Promise(() => {}),
};

// The draft as Search sends it: a pick still asking Google where it is waited for, and text that
// wasn't picked settled by one rule, in this order:
// 1. A county's name is the county filter, and an Eircode is a place.
// 2. Text that is the whole name of Google's first suggestion is searched nearest that place:
//    "Swords" is the town, though two homes have it in their name.
// 3. Text that a home's name matches is a name search: "elm" is Elm Hall, not Elm Park.
// 4. Anything else is replaced by Google's first suggestion, exactly as if that had been picked.
// 5. Text Google can't place (no suggestion, too late, failing or not in use) is searched as a name,
//    so the page can say nothing was found for it; an Eircode stays the Eircode it is.
export async function settleBox<T extends BoxFields>(draft: T, lookup: Lookup): Promise<T> {
  const { pick, hasName, findFirst, deadline } = lookup;
  if (pick && pick.label === draft.place && !draft.near) {
    const near = await before(deadline, pick.near);
    return near ? pickedPlace(draft, pick.label, near) : draft;
  }
  if (!needsLookup(draft, lookup.searched)) return draft;

  const text = draft.place.trim();
  const county = countyNamed(text);
  if (county) return pickedCounty(draft, county);
  const eircode = asEircode(text) !== null;
  // Asked together: a name must not go to a place because its answer waited behind Google's.
  const [suggestion, named] = await Promise.all([
    findFirst && asksGoogle(text) ? before(deadline, findFirst(text)) : null,
    eircode ? false : before(deadline, hasName(text)),
  ]);
  const wholeName = suggestion?.main.trim().toLowerCase() === text.toLowerCase();
  if (named && !wholeName) return pickedName(draft, text);

  if (suggestion?.county) return pickedCounty(draft, suggestion.county);
  const near = suggestion ? await before(deadline, suggestion.locate()) : null;
  if (suggestion && near) return pickedPlace(draft, suggestion.label, near);
  return eircode ? draft : pickedName(draft, text);
}
