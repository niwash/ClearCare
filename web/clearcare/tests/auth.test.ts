import { describe, expect, test } from "vitest";

import {
  SESSION_MAX_AGE_SECONDS,
  authConfigured,
  authUnavailable,
  createAuthConfig,
  missingAuthVariables,
  projectSession,
} from "@/lib/auth";

const completeEnv = {
  AUTH_SECRET: "test-secret",
  AUTH_COGNITO_ID: "test-client-id",
  AUTH_COGNITO_SECRET: "test-client-secret",
  AUTH_COGNITO_ISSUER:
    "https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_test",
  COGNITO_DOMAIN:
    "https://clearcare-dev-test.auth.eu-west-1.amazoncognito.com",
};

const session = {
  expires: "2026-11-03T00:00:00.000Z",
  user: { name: "Sawin Rya", email: "sawin@example.com" },
};

const tokenWithCredentials = {
  sub: "02c5c474-5051-7081-4a57-3a5bc3dacbd1",
  name: "Sawin Rya",
  email: "sawin@example.com",
  picture: "https://example.com/avatar.png",
  provider: "cognito",
  access_token: "access-token-value",
  id_token: "id-token-value",
  refresh_token: "refresh-token-value",
  expires_at: 1793103000,
};

function providerChecks(env: Record<string, string | undefined>): string[] {
  const config = createAuthConfig(env);
  // A built-in Auth.js provider keeps the caller's options under `options` and
  // merges them with its defaults when the request runs.
  const provider = config.providers[0] as {
    checks?: string[];
    options?: { checks?: string[] };
  };
  return provider.options?.checks ?? provider.checks ?? [];
}

describe("auth environment", () => {
  test("missing variables are named", () => {
    expect(missingAuthVariables({})).toEqual([
      "AUTH_SECRET",
      "AUTH_COGNITO_ID",
      "AUTH_COGNITO_SECRET",
      "AUTH_COGNITO_ISSUER",
      "COGNITO_DOMAIN",
    ]);
  });

  test("blank values count as missing", () => {
    expect(missingAuthVariables({ ...completeEnv, AUTH_SECRET: "   " })).toEqual([
      "AUTH_SECRET",
    ]);
  });

  test("complete environment is configured", () => {
    expect(authConfigured(completeEnv)).toBe(true);
    expect(authConfigured({})).toBe(false);
  });
});

describe("session", () => {
  test("projection keeps display fields", () => {
    const projected = projectSession(session, tokenWithCredentials);

    expect(projected.user?.email).toBe("sawin@example.com");
    expect(projected.user?.name).toBe("Sawin Rya");
    expect((projected.user as { sub?: string }).sub).toBe(
      tokenWithCredentials.sub,
    );
  });

  test("projection drops provider tokens", () => {
    const projected = projectSession(session, tokenWithCredentials);
    const serialised = JSON.stringify(projected);

    for (const key of [
      "access_token",
      "id_token",
      "refresh_token",
      "expires_at",
      "accessToken",
      "refreshToken",
    ]) {
      expect(serialised).not.toContain(key);
      expect(projected).not.toHaveProperty([key]);
    }
  });

  test("session lasts seven days with the jwt strategy", () => {
    const config = createAuthConfig(completeEnv);

    expect(config.session?.strategy).toBe("jwt");
    expect(config.session?.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
    expect(SESSION_MAX_AGE_SECONDS).toBe(604800);
  });
});

describe("oauth checks", () => {
  test("pkce, state and nonce are requested", () => {
    expect(providerChecks(completeEnv)).toEqual(
      expect.arrayContaining(["pkce", "state", "nonce"]),
    );
  });
});

describe("cookie security", () => {
  test("secure cookies follow the origin scheme", () => {
    const local = createAuthConfig({
      ...completeEnv,
      AUTH_URL: "http://localhost:3000",
    });
    const hosted = createAuthConfig({
      ...completeEnv,
      AUTH_URL: "https://clearcare.example.com",
    });

    expect(local.useSecureCookies).toBe(false);
    expect(hosted.useSecureCookies).toBe(true);
  });
});

describe("unconfigured environment", () => {
  test("account route answers 503", async () => {
    const response = authUnavailable();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "auth_not_configured",
    });
  });
});
