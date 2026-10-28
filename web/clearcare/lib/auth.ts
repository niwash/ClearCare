import NextAuth, { type NextAuthConfig, type Session } from "next-auth";
import Cognito from "next-auth/providers/cognito";

/** Seven days, the longest an authenticated ClearCare session may live. */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const REQUIRED_VARIABLES = [
  "AUTH_SECRET",
  "AUTH_COGNITO_ID",
  "AUTH_COGNITO_SECRET",
  "AUTH_COGNITO_ISSUER",
  "COGNITO_DOMAIN",
] as const;

type AuthEnvironment = Record<string, string | undefined>;

/** The variables that are absent, so an account page can name what is missing. */
export function missingAuthVariables(
  env: AuthEnvironment = process.env,
): string[] {
  return REQUIRED_VARIABLES.filter((name) => !env[name]?.trim());
}

export function authConfigured(env: AuthEnvironment = process.env): boolean {
  return missingAuthVariables(env).length === 0;
}

/**
 * The identity fields a page may render. Anything else on the token, including
 * provider tokens, stays inside the encrypted session cookie.
 */
export function projectSession(
  session: Session,
  token: Record<string, unknown>,
): Session {
  const email =
    typeof token.email === "string" ? token.email : session.user?.email;
  const name = typeof token.name === "string" ? token.name : session.user?.name;
  const sub = typeof token.sub === "string" ? token.sub : undefined;

  // A new object holds only these fields, so no other token value can leak.
  return {
    expires: session.expires,
    user: {
      ...(email ? { email } : {}),
      ...(name ? { name } : {}),
      ...(sub ? { sub } : {}),
    },
  } as Session;
}

/** The configuration for the Cognito provider and the ClearCare session. */
export function createAuthConfig(
  env: AuthEnvironment = process.env,
): NextAuthConfig {
  const origin = env.AUTH_URL ?? env.NEXTAUTH_URL ?? "";

  return {
    secret: env.AUTH_SECRET,
    trustHost: true,
    // A cookie marked Secure on http://localhost is dropped by the browser.
    useSecureCookies: origin.startsWith("https://"),
    session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
    providers: [
      Cognito({
        clientId: env.AUTH_COGNITO_ID,
        clientSecret: env.AUTH_COGNITO_SECRET,
        issuer: env.AUTH_COGNITO_ISSUER,
        checks: ["pkce", "state", "nonce"],
        authorization: { params: { scope: "openid email profile" } },
      }),
    ],
    callbacks: {
      session({ session, token }) {
        return projectSession(session, token as Record<string, unknown>);
      },
    },
  };
}

/**
 * Auth.js is constructed on first use, not at import, so a page that only asks
 * whether sign-in is configured does not need a secret to render.
 */
let runtime: ReturnType<typeof NextAuth> | undefined;

export function authRuntime(): ReturnType<typeof NextAuth> {
  runtime ??= NextAuth(createAuthConfig());
  return runtime;
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
