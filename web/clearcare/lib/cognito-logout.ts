// Cognito only returns the browser to a logout URI registered on the app client, so the allowlist
// here has to match `logout_urls` in the Terraform module. Today that is the site root: sign-out
// ends on the public welcome page, signed out, whatever the visitor asked for.
export const LOGOUT_PATHS = ["/"];

/** The registered URI to return to, or the root when the request asked for anything else. */
export function logoutUri(origin: string, path: string): string {
  const allowed = LOGOUT_PATHS.includes(path) ? path : "/";
  return new URL(allowed, origin).toString();
}

/**
 * Cognito's hosted logout endpoint, built from configuration only. A missing client ID or domain
 * returns null so the caller can clear the local session and say plainly that the hosted session
 * was not ended. The path is expected to be validated already: nothing from the request reaches
 * the origin or the client ID.
 */
export function cognitoLogoutUrl(
  env: Record<string, string | undefined>,
  origin: string,
  path = "/",
): string | null {
  const domain = env.COGNITO_DOMAIN?.trim();
  const clientId = env.AUTH_COGNITO_ID?.trim();

  if (!domain || !clientId) return null;

  let url: URL;
  try {
    url = new URL("/logout", domain);
  } catch {
    return null;
  }

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("logout_uri", logoutUri(origin, path));
  return url.toString();
}

/** Where the browser goes once the local session is cleared: the hosted logout when it can be
 * built, otherwise the start page carrying the notice. A malformed domain takes the same path as a
 * missing one: the visitor is told the provider was not asked, rather than left to assume it was. */
export function signOutDestination(
  env: Record<string, string | undefined>,
  origin: string,
  path = "/",
): string {
  return (
    cognitoLogoutUrl(env, origin, path) ??
    new URL("/?logout=unavailable", origin).toString()
  );
}

/** The ClearCare session cookies to remove. Auth.js prefixes them __Secure- or __Host- when the
 * connection is secure, so both have to match. */
export function sessionCookieNames(names: Iterable<string>): string[] {
  return [...names].filter((name) => /^(__Secure-|__Host-)?authjs\./.test(name));
}
