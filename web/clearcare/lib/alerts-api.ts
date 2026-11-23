// lib/alerts-api.ts
// The account's alert subscriptions as the API holds them (ADR-0034), called from the Next server
// only. As with the saved search, the browser never holds the token that says a request is the
// site's own: a page reads the list on the server, and the route handlers under app/api/alerts write
// and delete, taking the account from the session cookie.
//
// The one exception is the unsubscribe link, which is authenticated by its own token and takes no
// session (ADR-0034): that call passes the capability in the query and nothing else.
//
// Nothing here throws on the API being down or unset: alerts are an addition to a page, and one that
// cannot be read renders as if the feature were not there.
import { parseSubscription, parseSubscriptions, parsePackages, type AlertPackage, type AlertRequest, type AlertSubscription, alertRequestBody } from "./alerts";
import { apiUrl } from "./api-url";

const ACCOUNT_HEADER = "X-ClearCare-Sub";
const TOKEN_HEADER = "X-ClearCare-Token";

export type PackagesAnswer =
  | { ok: true; packages: AlertPackage[] }
  | { ok: false; reason: "unconfigured" | "refused" | "unreachable"; status: number; detail: string };

export type AlertsAnswer =
  | { ok: true; subscriptions: AlertSubscription[] }
  | { ok: false; reason: "unconfigured" | "refused" | "unreachable"; status: number; detail: string };

export type AlertAnswer =
  | { ok: true; subscription: AlertSubscription }
  | { ok: false; reason: "unconfigured" | "refused" | "unreachable"; status: number; detail: string };

type Failure = Extract<AlertsAnswer, { ok: false }>;

function settings() {
  return { url: apiUrl(), token: process.env.SITE_TOKEN?.trim() ?? "" };
}

// Whether this deployment can keep subscriptions at all. Missing, the strips and the page stay
// hidden: the API answers 503 for the same reason.
export function alertsConfigured() {
  const { url, token } = settings();
  return Boolean(url && token);
}

function unavailable(): Failure | null {
  const { url, token } = settings();
  if (url && token) return null;
  return {
    ok: false,
    reason: "unconfigured",
    status: 503,
    detail: "Alerts are not configured on this site.",
  };
}

async function detailOf(response: Response): Promise<string> {
  const problem: unknown = await response.json().catch(() => null);
  return typeof problem === "object" && problem !== null && "detail" in problem
    ? String((problem as { detail: unknown }).detail)
    : response.statusText;
}

function unreachable(): Failure {
  return { ok: false, reason: "unreachable", status: 0, detail: "The alerts service couldn't be reached." };
}

// The packages the API offers, and the ids a subscription to each one names (CCARE-271). Read at
// request time rather than assumed: the ids come from the database's identity column.
export async function listPackages(): Promise<PackagesAnswer> {
  const missing = unavailable();
  if (missing) return missing;
  const { url, token } = settings();

  let response: Response;
  try {
    response = await fetch(`${url}/alerts/packages`, {
      method: "GET",
      cache: "no-store",
      headers: { [TOKEN_HEADER]: token },
    });
  } catch {
    return unreachable();
  }

  if (!response.ok) {
    return { ok: false, reason: "refused", status: response.status, detail: await detailOf(response) };
  }

  return { ok: true, packages: parsePackages(await response.json().catch(() => null)) };
}

export async function listAlerts(cognitoSub: string): Promise<AlertsAnswer> {
  const missing = unavailable();
  if (missing) return missing;
  const { url, token } = settings();

  let response: Response;
  try {
    response = await fetch(`${url}/alerts/subscriptions`, {
      method: "GET",
      cache: "no-store",
      headers: { [ACCOUNT_HEADER]: cognitoSub, [TOKEN_HEADER]: token },
    });
  } catch {
    return unreachable();
  }

  if (!response.ok) {
    return { ok: false, reason: "refused", status: response.status, detail: await detailOf(response) };
  }

  return { ok: true, subscriptions: parseSubscriptions(await response.json().catch(() => null)) };
}

export async function addAlert(cognitoSub: string, packageId: number, request: AlertRequest): Promise<AlertAnswer> {
  const missing = unavailable();
  if (missing) return missing;
  const { url, token } = settings();

  let response: Response;
  try {
    response = await fetch(`${url}/alerts/subscriptions`, {
      method: "POST",
      cache: "no-store",
      headers: { [ACCOUNT_HEADER]: cognitoSub, [TOKEN_HEADER]: token, "content-type": "application/json" },
      body: JSON.stringify(alertRequestBody(packageId, request)),
    });
  } catch {
    return unreachable();
  }

  if (!response.ok) {
    return { ok: false, reason: "refused", status: response.status, detail: await detailOf(response) };
  }

  const stored = parseSubscription(await response.json().catch(() => null));
  if (!stored) {
    return { ok: false, reason: "refused", status: response.status, detail: "The alerts service answered with something the site can't read." };
  }
  return { ok: true, subscription: stored };
}

// True when the account no longer follows that target, which includes an id that was already gone
// or belongs to another account: the API answers 204 for all three.
export async function cancelAlert(cognitoSub: string, id: number): Promise<{ ok: true } | Failure> {
  const missing = unavailable();
  if (missing) return missing;
  const { url, token } = settings();

  let response: Response;
  try {
    response = await fetch(`${url}/alerts/subscriptions/${id}`, {
      method: "DELETE",
      cache: "no-store",
      headers: { [ACCOUNT_HEADER]: cognitoSub, [TOKEN_HEADER]: token },
    });
  } catch {
    return unreachable();
  }

  if (!response.ok) {
    return { ok: false, reason: "refused", status: response.status, detail: await detailOf(response) };
  }
  return { ok: true };
}

// The account's every alert at once: what the site sends when the every-report alert is stopped, the
// broadest target there is. Like a single cancel, 204 says the rows are gone whether or not any
// were there.
export async function cancelAllAlerts(cognitoSub: string): Promise<{ ok: true } | Failure> {
  const missing = unavailable();
  if (missing) return missing;
  const { url, token } = settings();

  let response: Response;
  try {
    response = await fetch(`${url}/alerts/subscriptions`, {
      method: "DELETE",
      cache: "no-store",
      headers: { [ACCOUNT_HEADER]: cognitoSub, [TOKEN_HEADER]: token },
    });
  } catch {
    return unreachable();
  }

  if (!response.ok) {
    return { ok: false, reason: "refused", status: response.status, detail: await detailOf(response) };
  }
  return { ok: true };
}

// The unsubscribe link's call: no session and no site token, only the capability (ADR-0034). A token
// no account holds is a 404, and a token whose rows are already gone is a 204, so pressing twice is
// not an error.
export async function unsubscribeFromAlerts(capability: string): Promise<{ ok: true } | Failure> {
  const { url } = settings();
  if (!url) {
    return { ok: false, reason: "unconfigured", status: 503, detail: "Alerts are not configured on this site." };
  }

  let response: Response;
  try {
    response = await fetch(`${url}/alerts/unsubscribe?token=${encodeURIComponent(capability)}`, {
      method: "POST",
      cache: "no-store",
    });
  } catch {
    return unreachable();
  }

  if (!response.ok) {
    return { ok: false, reason: "refused", status: response.status, detail: await detailOf(response) };
  }
  return { ok: true };
}
