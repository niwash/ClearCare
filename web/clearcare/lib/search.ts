// lib/search.ts
// The search contract for GET /centres (CCARE-45). Field names are the API's and stay snake_case.
// searchCentres calls the API at API_URL. For local work without the API, set USE_MOCK_DATA=true
// (e.g. in .env.local) to answer from the invented mock register instead, using the same rules.
// With neither, search reports that it isn't working rather than showing invented centres.
import { MOCK_CENTRES, MOCK_SNAPSHOT } from "./mock-centres";

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

// Straight from the URL, so the API (or the mock) does the validating.
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

// Only an explicit switch, so production can never show the invented centres as if they were real.
export function mockDataEnabled() {
  return process.env.USE_MOCK_DATA === "true";
}

// The API's base URL, or null if it isn't set.
export function apiUrl() {
  return process.env.API_URL?.replace(/\/$/, "") || null;
}

export async function searchCentres(query: SearchQuery): Promise<SearchResult> {
  if (mockDataEnabled()) return mockSearch(query);
  const url = apiUrl();
  if (!url) return { ok: false, status: 0, detail: "API_URL isn't set." };
  return fetchCentres(url, query);
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

// --- Mock: follows the rules in the contract so the page can be tested before the API exists ---

// Accents and apostrophes are ignored, so "aras" finds "Áras" and "josephs" finds "Joseph's".
function words(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Each typed word has to match the start of a word in the text, in any order.
function matchesWords(typed: string, text: string) {
  const target = words(text);
  return words(typed).every((word) => target.some((candidate) => candidate.startsWith(word)));
}

// The API's order: folded name compared character by character (so a space comes before any
// letter), then centre ID as a number.
function byFoldedName(a: CentreSummary, b: CentreSummary) {
  const keyA = words(a.centre_name).join(" ");
  const keyB = words(b.centre_name).join(" ");
  if (keyA !== keyB) return keyA < keyB ? -1 : 1;
  return Number(a.centre_id) - Number(b.centre_id);
}

function wholeNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  return /^\d+$/.test(value) ? Number(value) : NaN;
}

function mockSearch(query: SearchQuery): SearchResult {
  const badRequest = (detail: string): SearchResult => ({ ok: false, status: 400, detail });

  const page = wholeNumber(query.page, 1);
  if (!(page >= 1)) return badRequest("page must be a whole number of 1 or more");
  const pageSize = wholeNumber(query.page_size, 20);
  if (!(pageSize >= 1 && pageSize <= 50)) return badRequest("page_size must be between 1 and 50");

  // Case-sensitive, like the API: "dublin" is refused.
  for (const key of ["name", "address"] as const) {
    if ((query[key]?.length ?? 0) > MAX_TEXT_LENGTH) return badRequest(`${key} must be at most ${MAX_TEXT_LENGTH} characters`);
  }

  const county = query.county;
  if (county && !COUNTIES.includes(county)) return badRequest("county must be spelt as on the register, such as Dublin");

  const eircode = query.eircode?.replace(/\s+/g, "").toUpperCase();
  if (eircode && !looksLikeEircode(eircode)) {
    return badRequest("eircode must be a routing key such as W23 or a full Eircode such as W23 P6EX");
  }

  const matches = MOCK_CENTRES.filter(
    (centre) =>
      (!query.name || matchesWords(query.name, centre.centre_name)) &&
      (!query.address || matchesWords(query.address, centre.address)) &&
      (!county || centre.county === county) &&
      (!eircode ||
        (centre.eircode !== null &&
          (eircode.length === 7 ? centre.eircode === eircode : centre.eircode.startsWith(eircode)))),
  ).sort(byFoldedName);

  return {
    ok: true,
    data: {
      centres: matches.slice((page - 1) * pageSize, page * pageSize),
      page,
      page_size: pageSize,
      total: matches.length,
      register_snapshot: MOCK_SNAPSHOT,
    },
  };
}
