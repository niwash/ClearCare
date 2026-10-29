import NextAuth, { type NextAuthConfig, type Session } from "next-auth";
import Cognito from "next-auth/providers/cognito";

import {
  SESSION_MAX_AGE_SECONDS,
  authConfigured,
  authUnavailable,
  missingAuthVariables,
  projectSession,
  type AuthEnvironment,
} from "@/lib/auth-config";

// Re-exported so a page asks one module whether sign-in is available.
export {
  SESSION_MAX_AGE_SECONDS,
  authConfigured,
  authUnavailable,
  missingAuthVariables,
  projectSession,
};

/** The configuration for the Cognito provider and the ClearCare session. */
export function createAuthConfig(
  env: AuthEnvironment = process.env,
): NextAuthConfig {
  return {
    secret: env.AUTH_SECRET,
    // Both the load balancer and Vercel's proxy set the forwarded host, and the
    // task is reachable only through the load balancer, so it is ours to trust.
    trustHost: true,
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
        return projectSession(
          {
            expires: session.expires,
            // next-auth types these as string | null | undefined.
            user: {
              email: session.user?.email ?? undefined,
              name: session.user?.name ?? undefined,
            },
          },
          token as Record<string, unknown>,
        ) as unknown as Session;
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
