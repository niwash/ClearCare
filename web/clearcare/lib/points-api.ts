// lib/points-api.ts
// The points of the homes a search matches, or of every home when nothing is searched, for the
// search page's map (GET /centres/points), called from the Next server only. The coordinates are
// Google's, so the API gives them to nobody but the
// site, which proves itself with the token it shares with the API, and they are asked for again for
// every map and never cached (ADR-0029). The browser gets them from the page, only to draw the map.
//
// Nothing here throws on the API being down or unset: the page says the map isn't available and
// keeps its list. The tests load this file as it is (tests/points-api.test.ts), so its imports are
// named with their extension.
import { apiUrl } from "./api-url.ts";
import type { PageSearch } from "./page-search.ts";
import { apiFilterParams } from "./search-filters.ts";
import type { CentrePoint } from "./search-map.ts";

const TOKEN_HEADER = "X-ClearCare-Token";
// What a home must match and where distances are measured from. The points have no pages and one
// order, so the API refuses sort, page and page_size.
const MATCHING = ["name", "address", "eircode", "county", "near"] as const;

export type PointsAnswer =
  | { ok: true; points: CentrePoint[] }
  | { ok: false; reason: "unconfigured" | "refused" | "unreachable"; status: number; detail: string };

function settings() {
  return { url: apiUrl(), token: process.env.SITE_TOKEN?.trim() ?? "" };
}

// Whether this deployment can draw a map at all. Missing, the page offers none: the API answers 503
// for the same reason.
export function pointsConfigured() {
  const { url, token } = settings();
  return Boolean(url && token);
}

export async function readPoints(search: Pick<PageSearch, "query" | "selection">): Promise<PointsAnswer> {
  const { url, token } = settings();
  if (!url || !token) {
    return { ok: false, reason: "unconfigured", status: 503, detail: "The map is not configured on this site." };
  }

  const params = apiFilterParams(search.selection);
  for (const key of MATCHING) {
    const value = search.query[key];
    if (value) params.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(`${url}/centres/points?${params}`, { cache: "no-store", headers: { [TOKEN_HEADER]: token } });
  } catch {
    return { ok: false, reason: "unreachable", status: 0, detail: "The map's points couldn't be reached." };
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    return { ok: false, reason: "refused", status: response.status, detail: problem?.detail ?? response.statusText };
  }

  // The body can still fail after the headers said 200, as when the connection drops part-way.
  const answer: { points: CentrePoint[] } | null = await response.json().catch(() => null);
  if (!answer) return { ok: false, reason: "unreachable", status: 0, detail: "The map's points couldn't be read." };
  return { ok: true, points: answer.points };
}
