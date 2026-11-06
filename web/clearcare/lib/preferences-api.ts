// lib/preferences-api.ts
// The saved search as the API holds it (ADR-0025), called from the Next server only. The browser
// never holds the token that says a request is the site's own: the search page reads the saved
// search with it on every render, and the route handler under app/api/preferences writes and
// deletes one, reading the account from the session cookie and sending it, with the token, from
// here.
//
// Nothing here throws on the API being down or unset: a saved search is a convenience, and a page
// that cannot reach it renders as it did before there were any.
import { parseSavedSearch, savedSearchDocument, type SavedSearch } from "./preferences";
import { apiUrl } from "./search";

const ACCOUNT_HEADER = "X-ClearCare-Sub";
const TOKEN_HEADER = "X-ClearCare-Token";

export type SavedSearchAnswer =
  | { ok: true; saved: SavedSearch | null }
  | { ok: false; reason: "unconfigured" | "refused" | "unreachable"; status: number; detail: string };

function settings() {
  return { url: apiUrl(), token: process.env.SITE_TOKEN?.trim() ?? "" };
}

// Whether this deployment can keep a saved search at all. Missing, the controls stay hidden: the
// API answers 503 for the same reason.
export function preferencesConfigured() {
  const { url, token } = settings();
  return Boolean(url && token);
}

async function call(
  cognitoSub: string,
  method: "GET" | "PUT" | "DELETE",
  body?: unknown,
): Promise<SavedSearchAnswer> {
  const { url, token } = settings();
  if (!url || !token) {
    return {
      ok: false,
      reason: "unconfigured",
      status: 503,
      detail: "Saved searches are not configured on this site.",
    };
  }

  const headers: Record<string, string> = {
    [ACCOUNT_HEADER]: cognitoSub,
    [TOKEN_HEADER]: token,
  };
  if (body !== undefined) headers["content-type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${url}/preferences`, {
      method,
      cache: "no-store",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return {
      ok: false,
      reason: "unreachable",
      status: 0,
      detail: "The saved search service couldn't be reached.",
    };
  }

  // Forgetting answers no content.
  if (response.status === 204) return { ok: true, saved: null };

  if (!response.ok) {
    const problem: unknown = await response.json().catch(() => null);
    const detail =
      typeof problem === "object" && problem !== null && "detail" in problem
        ? String((problem as { detail: unknown }).detail)
        : response.statusText;
    return { ok: false, reason: "refused", status: response.status, detail };
  }

  const answer = (await response.json()) as { preferences?: unknown };
  return { ok: true, saved: parseSavedSearch(answer.preferences) };
}

export function readSavedSearch(cognitoSub: string): Promise<SavedSearchAnswer> {
  return call(cognitoSub, "GET");
}

export function saveSavedSearch(cognitoSub: string, saved: SavedSearch): Promise<SavedSearchAnswer> {
  return call(cognitoSub, "PUT", savedSearchDocument(saved));
}

export function forgetSavedSearch(cognitoSub: string): Promise<SavedSearchAnswer> {
  return call(cognitoSub, "DELETE");
}
