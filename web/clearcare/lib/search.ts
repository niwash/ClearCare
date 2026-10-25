// lib/search.ts
// The search contract for GET /centres (CCARE-45). Field names are the API's and stay snake_case.
// searchCentres calls the API at API_URL. Without it, search reports that it isn't working.

export interface CentreSummary {
  centre_id: string;
  centre_name: string;
  address: string;
  county: string;
  eircode: string | null; // without the space: "W23P6EX"
  maximum_occupancy: number | null; // the most residents HIQA allows, not free beds
  hiqa_url: string;
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
}

// Straight from the URL, so the API does the validating.
export interface SearchQuery {
  name?: string;
  address?: string;
  county?: string;
  eircode?: string;
  page?: string;
  page_size?: string;
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

export async function searchCentres(query: SearchQuery): Promise<SearchResult> {
  const url = apiUrl();
  if (!url) return { ok: false, status: 0, detail: "API_URL isn't set." };
  return fetchCentres(url, query);
}

// A centre page opened from the results gets the search as ?from=, so its breadcrumb can go back to it.
// Only the search's own parameters are kept, so ?from= can't point the breadcrumb anywhere else.
export function searchHref(from: string) {
  const given = new URLSearchParams(from);
  const params = new URLSearchParams();
  for (const key of ["name", "address", "county", "eircode", "page"]) {
    const value = given.get(key)?.trim();
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return search ? `/search?${search}` : "/search";
}

// What to tell the user when the data can't be read: the same words on every page.
export function unavailableMessage(status: number) {
  return status === 503
    ? "The HIQA register hasn't been loaded yet. Please try again in a few minutes."
    : "ClearCare can't reach its data at the moment. Please try again later.";
}

async function fetchCentres(apiUrl: string, query: SearchQuery): Promise<SearchResult> {
  const params = new URLSearchParams();
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
