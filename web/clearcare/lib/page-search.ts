// lib/page-search.ts
// The search as the page address holds it, and what it sends to GET /centres. It lives here, apart
// from lib/search.ts, because that file reads the API (next/server) and the tests load this one as it
// is (tests/page-search.test.ts), so its imports are named with their extension.
import { ANY_COUNTY } from "./counties.ts";
import { asEircode } from "./eircode.ts";
import { filterCount, readSelection, selectionParams, SORTS, type FilterSelection, type SortValue } from "./search-filters.ts";

// Straight from the URL, so the API does the validating, apart from eircode, which asEircode has
// already read from the place.
export interface SearchQuery {
  name?: string;
  address?: string;
  county?: string;
  eircode?: string;
  page?: string;
  page_size?: string;
  sort?: string;
}

// The search as the page address holds it: the name, one "Town, area or Eircode" field (place), the
// county, the care and amenity filters, the order and the page. place goes to the API as an Eircode
// if it looks like one, otherwise as an address; links from before it, with address or eircode,
// still work.
export interface PageSearch {
  query: SearchQuery; // for GET /centres, with the filters sent separately (apiFilterParams)
  name: string;
  place: string;
  county: string; // "" for any county
  selection: FilterSelection;
  sort: SortValue;
}

type PageParams = Record<string, string | string[] | undefined>;

function first(params: PageParams, key: string) {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function readSearch(params: PageParams): PageSearch {
  const name = first(params, "name");
  const place = first(params, "place") || first(params, "address") || first(params, "eircode");
  const countyValue = first(params, "county");
  const county = countyValue === ANY_COUNTY ? "" : countyValue;
  const sortValue = first(params, "sort");
  const sort = (SORTS.some((option) => option.value === sortValue) ? sortValue : "name") as SortValue;

  const query: SearchQuery = {};
  if (name) query.name = name;
  const eircode = asEircode(place);
  if (eircode) query.eircode = eircode;
  else if (place) query.address = place;
  if (county) query.county = county;
  if (sort !== "name") query.sort = sort;
  for (const key of ["page", "page_size"] as const) if (first(params, key)) query[key] = first(params, key);

  return { query, name, place, county, selection: readSelection(params), sort };
}

// Something to search for: a name, a place, a county or a filter.
export function hasSearch(search: Pick<PageSearch, "name" | "place" | "county" | "selection">) {
  return Boolean(search.name || search.place || search.county || filterCount(search.selection) > 0);
}

// The page address for a search, leaving out what's empty, so a shared link stays short.
export function searchHref(search: Pick<PageSearch, "name" | "place" | "county" | "selection" | "sort">, page = 1) {
  const params = new URLSearchParams();
  if (search.name) params.set("name", search.name);
  if (search.place) params.set("place", search.place);
  if (search.county) params.set("county", search.county);
  for (const [key, value] of selectionParams(search.selection)) params.set(key, value);
  if (search.sort !== "name") params.set("sort", search.sort);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `/search?${text}` : "/search";
}

// The address for a search that has just been emptied — "Clear all", or the last filter tag removed
// — which is the one page where a saved search must not open itself again. It says so in the address
// (?filtersCleared=true, read in app/(site)/search/page.tsx) so that leaving and coming back keeps it
// emptied.
export function filtersClearedHref(search: Pick<PageSearch, "name" | "place" | "county" | "selection" | "sort">) {
  const href = searchHref(search);
  return href === "/search" ? "/search?filtersCleared=true" : href;
}
