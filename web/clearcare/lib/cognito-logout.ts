// Cognito only returns the browser to a logout URI registered on the app client, and the module
// registers the site root, so that is the only destination built here.
//
// The origin is passed in rather than read from the request: behind the load balancer the server's
// own address is the container's (0.0.0.0:3000), so the caller resolves the public origin first.

/** Cognito's hosted logout endpoint, or null when it cannot be built from configuration. */
export function cognitoLogoutUrl(
  env: Record<string, string | undefined>,
  origin: string,
): string | null {
  const domain = env.COGNITO_DOMAIN?.trim();
  const clientId = env.AUTH_COGNITO_ID?.trim();

  if (!domain || !clientId) return null;

  let url: URL;
  let logoutUri: string;
  try {
    url = new URL("/logout", domain);
    logoutUri = new URL("/", origin).toString();
  } catch {
    return null;
  }

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("logout_uri", logoutUri);
  return url.toString();
}
