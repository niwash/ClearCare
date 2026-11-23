// app/api/alerts/subscriptions/[id]/route.ts
// Stop following one target (CCARE-271): DELETE one subscription of the signed-in account.
//
// The id comes from the list the page read on the server. The account comes from the session, never
// from the request, so an id that belongs to another account is answered the same way as one that is
// already gone — the API checks the row against the account before deleting it — and a second press
// is not an error.
import { authRuntime } from "@/lib/auth";
import { authConfigured, authUnavailable, sessionSubject } from "@/lib/auth-config";
import { alertsConfigured, cancelAlert } from "@/lib/alerts-api";

function unconfigured(): Response {
  return Response.json(
    { error: "alerts_not_configured", message: "Alerts are not configured on this site." },
    { status: 503 },
  );
}

function notSignedIn(): Response {
  return Response.json(
    { error: "not_signed_in", message: "Sign in to change your alerts." },
    { status: 401 },
  );
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!authConfigured()) return authUnavailable();
  if (!alertsConfigured()) return unconfigured();

  const sub = sessionSubject(await authRuntime().auth());
  if (!sub) return notSignedIn();

  const { id } = await context.params;
  const wanted = Number(id);
  if (!Number.isInteger(wanted) || wanted <= 0) {
    return Response.json(
      { error: "invalid_subscription", message: "That is not an alert subscription." },
      { status: 400 },
    );
  }

  const result = await cancelAlert(sub, wanted);
  if (result.ok) return new Response(null, { status: 204 });

  if (result.reason === "unconfigured") return unconfigured();
  return Response.json({ error: "alerts_unavailable", message: result.detail }, { status: 502 });
}
