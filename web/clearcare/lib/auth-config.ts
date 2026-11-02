/**
 * Seven days without use. Auth.js extends the expiry each time the session is
 * read, so this is an idle limit, not a fixed lifespan for an account.
 */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

// COGNITO_DOMAIN is read by the sign-up provider: without it there is no
// hosted sign-up page to send "Create account" to, so the site would offer a
// button that only reaches an error page.
const REQUIRED_VARIABLES = [
  "AUTH_SECRET",
  "AUTH_COGNITO_ID",
  "AUTH_COGNITO_SECRET",
  "AUTH_COGNITO_ISSUER",
  "COGNITO_DOMAIN",
] as const;

/** The environment the authentication helpers read. */
export type AuthEnvironment = Record<string, string | undefined>;

/** The session a page is allowed to see: identity for display, nothing else. */
export type DisplaySession = {
  expires: string;
  user: { email?: string; name?: string; sub?: string };
};

/** The variables that are absent, so an account page can name what is missing. */
export function missingAuthVariables(
  env: AuthEnvironment = process.env,
): string[] {
  return REQUIRED_VARIABLES.filter((name) => !env[name]?.trim());
}

/** Whether every variable that sign-in needs is present. */
export function authConfigured(env: AuthEnvironment = process.env): boolean {
  return missingAuthVariables(env).length === 0;
}

/**
 * The identity fields a page may render. Anything else on the token, including
 * provider tokens, stays inside the encrypted session cookie.
 */
export function projectSession(
  session: DisplaySession,
  token: Record<string, unknown>,
): DisplaySession {
  const email =
    typeof token.email === "string" ? token.email : session.user.email;
  const name = typeof token.name === "string" ? token.name : session.user.name;
  const sub = typeof token.sub === "string" ? token.sub : undefined;

  // A new object holds only these fields, so no other token value can leak.
  return {
    expires: session.expires,
    user: {
      ...(email ? { email } : {}),
      ...(name ? { name } : {}),
      ...(sub ? { sub } : {}),
    },
  };
}

/**
 * The account id a page keys on. Without an adapter next-auth gives every
 * sign-in a fresh random user id, so the token's own subject would change for
 * the same person; Cognito's profile carries the stable one. Only a sign-in
 * passes an account, so later reads keep whatever the token already holds.
 */
export function pinSubject(
  token: Record<string, unknown>,
  account: { providerAccountId?: string } | null | undefined,
  profile: { sub?: unknown } | null | undefined,
): Record<string, unknown> {
  if (!account) return token;

  const claimed = typeof profile?.sub === "string" ? profile.sub.trim() : "";
  const subject = claimed || account.providerAccountId?.trim();
  if (subject) token.sub = subject;

  return token;
}

/** The answer an account route gives when the environment is incomplete. */
export function authUnavailable(): Response {
  return Response.json(
    {
      error: "auth_not_configured",
      message: "Sign-in is not configured on this site.",
    },
    { status: 503 },
  );
}
