// app/api/alerts/subscriptions/route.ts
// The signed-in visitor's alert subscriptions (ADR-0034, CCARE-271): POST one, or DELETE them all.
//
// Reading the list is not here: each page that shows a strip, and the /alerts page, read it on the
// server, so a GET would be one more way in to keep guarded for no caller. What remains is what the
// browser changes, and it talks to this route with its session cookie and nothing else. The route
// takes the account's subject claim out of the session and forwards the request to the API with the
// token that proves it is the site's, so no token and no account id ever comes from the page: a
// caller cannot add a subscription to another account, only to its own.
import { authRuntime } from "@/lib/auth";
import { authConfigured, authUnavailable, sessionSubject } from "@/lib/auth-config";
import { packageForKind, parseAlertRequest } from "@/lib/alerts";
import { addAlert, alertsConfigured, cancelAllAlerts, listPackages, type AlertAnswer } from "@/lib/alerts-api";

function unconfigured(): Response {
  return Response.json(
    { error: "alerts_not_configured", message: "Alerts are not configured on this site." },
    { status: 503 },
  );
}

function notSignedIn(): Response {
  return Response.json(
    { error: "not_signed_in", message: "Sign in to get alerts." },
    { status: 401 },
  );
}

// The account this request is for, or the refusal to answer with.
async function account(): Promise<{ sub: string } | Response> {
  if (!authConfigured()) return authUnavailable();

  const sub = sessionSubject(await authRuntime().auth());
  return sub ? { sub } : notSignedIn();
}

// The API's answer as this route's own. A row the site cannot read is not an answer it can hand on,
// so it is treated like any other refusal from the API.
function answer(result: AlertAnswer): Response {
  if (result.ok) return Response.json({ subscription: result.subscription });
  if (result.reason === "unconfigured") return unconfigured();
  return Response.json({ error: "alerts_unavailable", message: result.detail }, { status: 502 });
}

export async function POST(request: Request): Promise<Response> {
  const caller = await account();
  if (caller instanceof Response) return caller;
  if (!alertsConfigured()) return unconfigured();

  // The kind of target is checked here as well as by the API: a body that names a target the site
  // never offers is a mistake, not something to send on.
  const body: unknown = await request.json().catch(() => null);
  const wanted = parseAlertRequest(body);
  if (!wanted) {
    return Response.json(
      { error: "invalid_subscription", message: "That is not an alert the site offers." },
      { status: 400 },
    );
  }

  // Which package that kind of target is, this database's answer rather than the seed's order: the
  // ids come from an identity column and a deployment whose sequence has moved on numbers them
  // differently (CCARE-271).
  const offered = await listPackages();
  if (!offered.ok) {
    if (offered.reason === "unconfigured") return unconfigured();
    return Response.json({ error: "alerts_unavailable", message: offered.detail }, { status: 502 });
  }
  const pack = packageForKind(offered.packages, wanted.kind);
  if (!pack) {
    return Response.json(
      { error: "alerts_unavailable", message: "This site is not offering that kind of alert just now." },
      { status: 502 },
    );
  }

  return answer(await addAlert(caller.sub, pack.id, wanted));
}

// Every alert at once. The list sends this when the visitor stops the every-report alert, which is
// the broadest target an account can follow, so cancelling it leaves nothing to send. The account
// still comes from the session, so this can only empty the caller's own list.
export async function DELETE(): Promise<Response> {
  const caller = await account();
  if (caller instanceof Response) return caller;
  if (!alertsConfigured()) return unconfigured();

  const stopped = await cancelAllAlerts(caller.sub);
  if (stopped.ok) return new Response(null, { status: 204 });
  if (stopped.reason === "unconfigured") return unconfigured();
  return Response.json({ error: "alerts_unavailable", message: stopped.detail }, { status: 502 });
}
