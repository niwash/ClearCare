// tests/public-routes.test.ts
// The account entries and exits are the only places a visitor gains or loses a session, so they are
// read here as source: which handlers exist, how sign-out leaves, and that no page of ours ever asks
// for a password. Rendering is covered by `npm run build`.
// Run with: npm test
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, test } from "node:test";

const read = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const sourceFiles = (path: string): string[] => {
  const found: string[] = [];
  for (const entry of readdirSync(new URL(`../${path}`, import.meta.url))) {
    const relative = `${path}/${entry}`;
    const stat = statSync(new URL(`../${relative}`, import.meta.url));
    if (stat.isDirectory()) found.push(...sourceFiles(relative));
    else if (/\.(tsx?|mjs)$/.test(entry)) found.push(relative);
  }
  return found;
};

describe("account entries and exits", () => {
  test("the sign-in callback answers GET and POST", () => {
    const route = read("app/api/auth/[...nextauth]/route.ts");

    assert.match(route, /export \{ GET, POST \}|export async function (GET|POST)/);
  });

  test("the controls offer a way out, whatever shape it takes", () => {
    const controls = read("components/auth/account-controls.tsx");

    // Sign-out itself (its URL, its cookies, the origin it returns to) is covered by the tests that
    // come with it; here the check is that a signed-in visitor is never left without a way out.
    assert.match(controls, /Log out/);
    assert.match(controls, /form action=\{|href="\/sign-out"/);
  });
});

describe("nothing redirects to a value taken from the request", () => {
  const sources = ["lib/auth-actions.ts", "app/api/auth/[...nextauth]/route.ts"];

  test("every redirect is built from configuration or a checked path", () => {
    for (const file of sources) {
      const source = read(file);

      assert.doesNotMatch(
        source,
        /redirect\(\s*(?:request|searchParams|referer|headers\(\))/i,
        `${file} redirects a value it has not checked`,
      );
    }
  });

  test("no route reads the whole request URL", () => {
    for (const file of sources) {
      assert.doesNotMatch(read(file), /nextUrl\.(href|search(?!Params)\b|toString\()/);
    }
  });
});

describe("no page of ours asks for a password", () => {
  test("no password input anywhere in the app", () => {
    const files = [...sourceFiles("app"), ...sourceFiles("components/auth"), ...sourceFiles("lib")];
    const offenders = files.filter((file) => /type=["']password["']/.test(read(file)));

    assert.deepEqual(offenders, [], "Log in and Create account must post straight to Cognito");
  });
});
