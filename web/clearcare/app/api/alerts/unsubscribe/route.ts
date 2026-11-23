// app/api/alerts/unsubscribe/route.ts
// The unsubscribe link's call (CCARE-271), the one route here that is public (ADR-0034).
//
// The link in the email carries a capability for one account. Holding it is the proof, so there is
// no session and no site token: the route passes the token on to the API, which deletes every
// subscription of the account behind it. A token no account holds is a 404. Repeating the call with
// a valid token answers 204 even after the rows are gone, so a reloaded page is not an error.
//
// It is a POST for exactly this reason: a mail client or a link scanner that only opens the page
// changes nothing. The page at /alerts/unsubscribe asks first, then sends this.
import { unsubscribeFromAlerts } from "@/lib/alerts-api";
import { unsubscribeToken } from "@/lib/alerts";

export async function POST(request: Request): Promise<Response> {
  const token = unsubscribeToken(new URL(request.url).searchParams.get("token"));
  if (!token) {
    return Response.json(
      { error: "invalid_token", message: "That unsubscribe link is not valid." },
      { status: 404 },
    );
  }

  const result = await unsubscribeFromAlerts(token);
  if (result.ok) return new Response(null, { status: 204 });

  if (result.reason === "unconfigured") {
    return Response.json(
      { error: "alerts_not_configured", message: "Alerts are not configured on this site." },
      { status: 503 },
    );
  }
  // A token the API does not know is the visitor's answer too, so it keeps its 404 rather than
  // becoming the 502 an unreachable service gets.
  const status = result.status === 404 ? 404 : result.reason === "unreachable" ? 502 : 502;
  return Response.json(
    { error: status === 404 ? "unknown_token" : "alerts_unavailable", message: result.detail },
    { status },
  );
}
