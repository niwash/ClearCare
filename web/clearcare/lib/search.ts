// lib/search.ts
// The search contract for GET /centres (CCARE-45). Field names are the API's and stay snake_case.
// searchCentres calls the API at API_URL. Without it, search reports that it isn't working.
import { connection } from "next/server";
import { filterCount, readSelection, selectionParams, SORTS, type FilterSelection, type SortValue } from "./search-filters";

export interface CentreSummary {
  centre_id: string;
  centre_name: string;
  address: string;
  county: string;
  eircode: string | null; // without the space: "W23P6EX"
  maximum_occupancy: number | null; // the most residents HIQA allows, not free beds
  hiqa_url: string;
  // From an API with the care and amenity filters (lib/search-filters.ts); absent before it.
  amenities?: MentionedAmenities | null; // null when none of its reports has been read yet
  fair_deal?: boolean; // the API has an HSE contract price for it, so it takes part in Fair Deal
  // The newest loaded report; date is null when the report doesn't give one.
  latest_inspection?: { date: string | null } | null;
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
  centres: CentreSummary[]; // alphabetical by name, no ranking
  page: number;
  page_size: number;
  total: number;
  register_snapshot: RegisterSnapshot;
  // From an API with the filters. Each option's count is how many homes would match with it ticked
  // too, given the other filters. Without facets the filters aren't offered, so nothing looks
  // filtered when it isn't. fair_deal only with the Fair Deal filter (FAIR_DEAL_FILTER).
  facets?: Record<"care_type" | "room_type" | "facility" | "activity", Record<string, number>> & { fair_deal?: number };
  // With no matches: how many there would be without each active filter.
  relaxations?: { param: string; value?: string; total: number }[];
  sort?: string; // the order applied, echoed; without it, results are by name
}

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

// The County enum in api/openapi.yaml. The API is case-sensitive, so these are the only values to send.
export const COUNTIES = [
  "Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway", "Kerry", "Kildare",
  "Kilkenny", "Laois", "Leitrim", "Limerick", "Longford", "Louth", "Mayo", "Meath", "Monaghan",
  "Offaly", "Roscommon", "Sligo", "Tipperary", "Waterford", "Westmeath", "Wexford", "Wicklow",
];

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
  const result = await fetchCentres(url, query, filters);
  // An API from before the filters rejects their parameters with a 400 ("care_type is not a
  // parameter"), so search again without them: with no facets, the page then shows the results
  // unfiltered and offers no filters, as if the address had none. An API with the filters answers
  // with facets, so its 400 was about the filter itself (an unknown item) and stands.
  if (!result.ok && result.status === 400 && filters?.toString()) {
    const unfiltered = await fetchCentres(url, query);
    if (unfiltered.ok && !unfiltered.data.facets) return unfiltered;
  }
  return result;
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

const ROUTING_KEY = /^([AC-FHKNPRTV-Y]\d{2}|D6W)$/;
const FULL_EIRCODE = /^([AC-FHKNPRTV-Y]\d{2}|D6W)[0-9AC-FHKNPRTV-Y]{4}$/;

// "D06", "w23 p6ex" and "W23P6EX" are Eircodes; "Elm Hall" isn't.
export function looksLikeEircode(text: string) {
  const compact = text.replace(/\s+/g, "").toUpperCase();
  return ROUTING_KEY.test(compact) || FULL_EIRCODE.test(compact);
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

// The county list's "Any county" value. It means no county, as a blank does.
export const ANY_COUNTY = "any";

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
