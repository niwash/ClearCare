// lib/search.ts
// The search contract for GET /centres (CCARE-45). Field names are the API's and stay snake_case.
// searchCentres calls the API at API_URL. Without it, search reports that it isn't working.
import { connection } from "next/server";
import { ANY_COUNTY, COUNTIES } from "./counties.ts";
import { looksLikeEircode } from "./eircode.ts";
import { filterCount, readSelection, selectionParams, SORTS, type FilterSelection, type SortValue } from "./search-filters";

// The counties the API accepts (the County enum in api/openapi.yaml) and the county list's "any"
// value are in lib/counties.ts: the saved-search tests load them without this file's API call.
export { ANY_COUNTY, COUNTIES };

export interface CentreSummary {
  centre_id: string;
  centre_name: string;
  address: string;
  county: string;
  eircode: string | null; // without the space: "W23P6EX"
  maximum_occupancy: number | null; // the most residents HIQA allows, not free beds
  hiqa_url: string;
  amenities: MentionedAmenities | null; // null when none of its reports has been read yet
  fair_deal: boolean; // the API has an HSE contract price for it, so it takes part in Fair Deal
  // The newest loaded report, or null when it has none; date is null when the report gives none.
  latest_inspection: { date: string | null } | null;
}

// What a home's latest read report mentions (MentionedAmenities in api/openapi.yaml), item names only:
// the record the centre page shows with its passages. The report can be older than
// latest_inspection, as the newest report may not have been read yet.
export interface MentionedAmenities {
  report_id: number;
  inspection_date: string | null;
  care_types: string[];
  room_types: string[];
  facilities: string[];
  activities: string[];
}

// Which copy of the HIQA register the results come from.
export interface RegisterSnapshot {
  fetched_at: string;
  url: string;
  sha256: string;
}

export interface SearchResponse {
  centres: CentreSummary[]; // in the order sort names, no ranking
  page: number;
  page_size: number;
  total: number;
  register_snapshot: RegisterSnapshot;
  // Every item of every list, with how many homes would match with it ticked too, given the other
  // filters; and how many of the matching homes take part in Fair Deal. On every page.
  facets: Facets;
  sort: SortValue; // the order applied, echoed
}

export type Facets = Record<"care_type" | "room_type" | "facility" | "activity", Record<string, number>> & { fair_deal: number };

// Straight from the URL, so the API does the validating.
export interface SearchQuery {
  name?: string;
  address?: string;
  county?: string;
  eircode?: string;
  page?: string;
  page_size?: string;
  sort?: string;
}

export type SearchResult =
  | { ok: true; data: SearchResponse }
  | { ok: false; status: number; detail: string };

// The longest name or address the API accepts.
export const MAX_TEXT_LENGTH = 100;

// The API's base URL, or null if it isn't set.
export function apiUrl() {
  return process.env.API_URL?.replace(/\/$/, "") || null;
}

// filters: the care and amenity filters' parameters (apiFilterParams, lib/search-filters.ts).
export async function searchCentres(query: SearchQuery, filters?: URLSearchParams): Promise<SearchResult> {
  // Read the API on each request. Otherwise a build without API_URL prerenders the pages that
  // search, such as /, as "API_URL isn't set" until the next build.
  await connection();
  const url = apiUrl();
  if (!url) return { ok: false, status: 0, detail: "API_URL isn't set." };
  return fetchCentres(url, query, filters);
}


// What to tell the user when the data can't be read: the same words on every page.
export function unavailableMessage(status: number) {
  return status === 503
    ? "The HIQA register hasn't been loaded yet. Please try again in a few minutes."
    : "ClearCare can't reach its data at the moment. Please try again later.";
}

async function fetchCentres(apiUrl: string, query: SearchQuery, filters?: URLSearchParams): Promise<SearchResult> {
  const params = new URLSearchParams(filters);
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/centres?${params}`, { cache: "no-store" });
  } catch {
    return { ok: false, status: 0, detail: "The search service couldn't be reached." };
  }
  if (response.ok) return { ok: true, data: await response.json() };

  const body = await response.json().catch(() => null);
  return { ok: false, status: response.status, detail: body?.detail ?? response.statusText };
}

// "W23P6EX" → "W23 P6EX". Routing keys and anything unexpected are left alone.
export function formatEircode(eircode: string) {
  return eircode.length === 7 ? `${eircode.slice(0, 3)} ${eircode.slice(3)}` : eircode;
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
  if (place) query[looksLikeEircode(place) ? "eircode" : "address"] = place;
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
