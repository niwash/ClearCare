// app/api/preferences/route.ts
// The signed-in visitor's saved search (ADR-0025): GET it, PUT one, DELETE it.
//
// The browser talks to this route with its session cookie and nothing else. The route takes the
// account's subject claim out of the session and forwards the request to the API with the token
// that proves it is the site's, so no token and no account id ever comes from the page: a caller
// cannot name another account's saved search, only its own.
import { authRuntime } from "@/lib/auth";
import { authConfigured, authUnavailable, sessionSubject } from "@/lib/auth-config";
import { parseSavedSearch, savedSearchDocument } from "@/lib/preferences";
import {
  forgetSavedSearch,
  preferencesConfigured,
  readSavedSearch,
  saveSavedSearch,
  type SavedSearchAnswer,
} from "@/lib/preferences-api";

function unconfigured(): Response {
  return Response.json(
    {
      error: "preferences_not_configured",
      message: "Saved searches are not configured on this site.",
    },
    { status: 503 },
  );
}

function notSignedIn(): Response {
  return Response.json(
    { error: "not_signed_in", message: "Sign in to keep your choices for next time." },
    { status: 401 },
  );
}

// The account this request is for, or the refusal to answer with. Signed-in only: there is nowhere
// to keep a saved search for a visitor without an account.
async function account(): Promise<{ sub: string } | Response> {
  if (!authConfigured()) return authUnavailable();

  const sub = sessionSubject(await authRuntime().auth());
  return sub ? { sub } : notSignedIn();
}

// The API's answer as this route's own. The document travels in the API's shape, the one
// parseSavedSearch reads and savedSearchDocument writes: a page that rebuilt it from anything else
// would lose the ticked options, which is what happened when this answered the site's own shape.
function answer(result: SavedSearchAnswer): Response {
  if (result.ok) {
    return Response.json({
      saved: result.saved === null ? null : savedSearchDocument(result.saved),
    });
  }
  if (result.reason === "unconfigured") return unconfigured();
  return Response.json({ error: "preferences_unavailable", message: result.detail }, { status: 502 });
}

export async function GET(): Promise<Response> {
  const caller = await account();
  if (caller instanceof Response) return caller;
  if (!preferencesConfigured()) return unconfigured();

  return answer(await readSavedSearch(caller.sub));
}

export async function PUT(request: Request): Promise<Response> {
  const caller = await account();
  if (caller instanceof Response) return caller;
  if (!preferencesConfigured()) return unconfigured();

  // The page sends the document it read from this route's GET; anything else is a mistake rather
  // than something to store.
  const body: unknown = await request.json().catch(() => null);
  const saved = parseSavedSearch(body);
  if (!saved) {
    return Response.json(
      { error: "invalid_preferences", message: "That is not a saved search." },
      { status: 400 },
    );
  }

  return answer(await saveSavedSearch(caller.sub, saved));
}

export async function DELETE(): Promise<Response> {
  const caller = await account();
  if (caller instanceof Response) return caller;
  if (!preferencesConfigured()) return unconfigured();

  const result = await forgetSavedSearch(caller.sub);
  return result.ok ? new Response(null, { status: 204 }) : answer(result);
}
