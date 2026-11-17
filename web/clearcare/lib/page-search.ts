// lib/page-search.ts
// The search as the page address holds it, and what it sends to GET /centres. It lives here, apart
// from lib/search.ts, because that file reads the API (next/server) and the tests load this one as it
// is (tests/page-search.test.ts), so its imports are named with their extension.
import { ANY_COUNTY } from "./counties.ts";
import { asEircode } from "./eircode.ts";
import { readNear } from "./near.ts";
import { filterCount, readSelection, selectionParams, SORTS, type FilterSelection, type SortValue } from "./search-filters.ts";

// Straight from the URL, so the API does the validating, apart from eircode, which asEircode has
// already read from the place, and near, which readNear has rounded.
export interface SearchQuery {
  name?: string;
  address?: string;
  county?: string;
  eircode?: string;
  near?: string;
  page?: string;
  page_size?: string;
  sort?: string;
}

// How the results are shown on a screen too narrow for both: the list of cards, or every matching
// home as a pin on a map (CCARE-229). A wide screen shows the two side by side whichever this is
// (CCARE-230).
export type SearchView = "list" | "map";

// The name, the town, area or Eircode (place), the point distances are measured from (near),
// the county, the care and amenity filters, the order, the view and the page. Without near, place goes to the
// API as an Eircode if it looks like one, otherwise as an address; links from before it, with address
// or eircode, still work. With near, place is only the name of the point (CCARE-228): near filters
// nothing, so a place picked from the suggestions finds every home, nearest first.
export interface PageSearch {
  query: SearchQuery; // for GET /centres, with the filters sent separately (apiFilterParams)
  name: string;
  place: string;
  near: string; // "53.35,-6.26", or "" for none
  county: string; // "" for any county
  selection: FilterSelection;
  sort: SortValue;
  view: SearchView; // the page's own: GET /centres is not sent it
}

type PageParams = Record<string, string | string[] | undefined>;

function first(params: PageParams, key: string) {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function readSearch(params: PageParams): PageSearch {
  const name = first(params, "name");
  const place = first(params, "place") || first(params, "address") || first(params, "eircode");
  const near = readNear(first(params, "near"));
  const countyValue = first(params, "county");
  const county = countyValue === ANY_COUNTY ? "" : countyValue;
  const sortValue = first(params, "sort");
  const known = SORTS.some((option) => option.value === sortValue) && (sortValue !== "distance" || near);
  const sort = (known ? sortValue : "name") as SortValue;

  const query: SearchQuery = {};
  if (name) query.name = name;
  const eircode = asEircode(place);
  if (near) query.near = near;
  else if (eircode) query.eircode = eircode;
  else if (place) query.address = place;
  if (county) query.county = county;
  if (sort !== "name") query.sort = sort;
  for (const key of ["page", "page_size"] as const) if (first(params, key)) query[key] = first(params, key);

  const view: SearchView = first(params, "view") === "map" ? "map" : "list";

  return { query, name, place, near, county, selection: readSelection(params), sort, view };
}

export function hasSearch(search: Pick<PageSearch, "name" | "place" | "near" | "county" | "selection">) {
  return Boolean(search.name || search.place || search.near || search.county || filterCount(search.selection) > 0);
}

// Whether the search can leave any home out, so that its count says something. A point (near) only
// orders the homes: with nothing else, every home in the register is listed, and "547 nursing homes"
// would read to someone who has just said where they are as if the place did nothing (CCARE-228).
export function leavesHomesOut(search: Pick<PageSearch, "name" | "place" | "near" | "county" | "selection">) {
  return Boolean(search.name || (search.place && !search.near) || search.county || filterCount(search.selection) > 0);
}

// view is left out by the links that only ever lead to the list, such as a saved search's.
type LinkedSearch = Pick<PageSearch, "name" | "place" | "near" | "county" | "selection" | "sort"> & { view?: SearchView };

// The page address for a search, leaving out what's empty, so a shared link stays short. The map is
// a view of a search's results, so it is written only when there is a search: an emptied search
// leads to the same address from either view (filtersClearedHref).
export function searchHref(search: LinkedSearch, page = 1) {
  const params = new URLSearchParams();
  if (search.name) params.set("name", search.name);
  if (search.place) params.set("place", search.place);
  if (search.near) params.set("near", search.near);
  if (search.county) params.set("county", search.county);
  for (const [key, value] of selectionParams(search.selection)) params.set(key, value);
  if (search.sort !== "name") params.set("sort", search.sort);
  if (search.view === "map" && hasSearch(search)) params.set("view", "map");
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `/search?${text}` : "/search";
}

// The address for a search that has just been emptied — "Clear all", or the last filter tag removed
// — which is the one page where a saved search must not open itself again. It says so in the address
// (?filtersCleared=true, read in app/(site)/search/page.tsx) so that leaving and coming back keeps it
// emptied.
export function filtersClearedHref(search: LinkedSearch) {
  const href = searchHref(search);
  return href === "/search" ? "/search?filtersCleared=true" : href;
}
