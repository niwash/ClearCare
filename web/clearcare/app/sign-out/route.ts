import { NextResponse, type NextRequest } from "next/server";

import { authConfigured } from "@/lib/auth-config";
import { cognitoLogoutUrl, sessionCookieNames } from "@/lib/cognito-logout";
import { safeReturnPath } from "@/lib/return-to";

// Sign-out is two steps in one request: ClearCare's own session is destroyed here, then the browser
// is sent to Cognito's hosted logout so the next sign-in asks for credentials instead of silently
// reusing the hosted session.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.nextUrl.origin;
  // Internal only, and only paths the app client has registered; logoutUri falls back to the root.
  const requested = safeReturnPath(request.nextUrl.searchParams.get("returnTo"));

  const hostedLogout = authConfigured()
    ? cognitoLogoutUrl(process.env, origin, requested)
    : null;

  // A missing identity provider is a visible failure, not a silent one: the local session still
  // goes, and the visitor is told the hosted session was left alone.
  const destination = hostedLogout ?? new URL("/?logout=unavailable", origin).toString();
  const response = NextResponse.redirect(destination);

  for (const name of sessionCookieNames(request.cookies.getAll().map((cookie) => cookie.name))) {
    response.cookies.delete(name);
  }

  return response;
}
