// tests/preferences-route.test.ts
// The route under app/api/preferences is the one place a saved search is read or written, and the
// one place the API's token is used. It imports next-auth and next/server, so no runner here can
// hold it: the decisions are read as source, and a curl against a running server is what proves the
// response (as with sign-out, tests/cognito-logout.test.ts).
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

describe("the saved-search route", () => {
  const route = read("app/api/preferences/route.ts");

  // The account is the session's subject. A page that could name one would be able to read another
  // account's saved search.
  test("takes the account from the session and never from the request", () => {
    assert.match(route, /sessionSubject\(/);
    assert.doesNotMatch(route, /request\.(headers|url|nextUrl)/);
    assert.doesNotMatch(route, /searchParams/);
  });

  test("refuses a visitor who is not signed in, and a deployment without the environment", () => {
    assert.match(route, /notSignedIn\(\)/);
    assert.match(route, /status: 401/);
    assert.match(route, /unconfigured\(\)/);
    assert.match(route, /status: 503/);
  });

  // What is stored is what the site can render, whatever the body says.
  test("checks a document before it is saved", () => {
    assert.match(route, /parseSavedSearch\(/);
    assert.match(route, /status: 400/);
  });

  // The page parses what this route answers with the same function that reads the API's document,
  // so the answer has to be that document: answering the page's own nested shape loses the ticked
  // options, which is a fault this assertion is here to keep out.
  test("answers in the shape the page parses", () => {
    assert.match(route, /savedSearchDocument\(result\.saved\)/);
  });

  test("offers all three things a visitor can do with a saved search", () => {
    assert.match(route, /export async function GET/);
    assert.match(route, /export async function PUT/);
    assert.match(route, /export async function DELETE/);
    assert.match(route, /forgetSavedSearch\(/);
  });
});

describe("the token behind the API call", () => {
  // A component runs in the browser, so the token must not be reachable from one. Only the route
  // handler, on the server, imports the module that reads it.
  test("is read on the server only", () => {
    const offenders = sourceFiles("components").filter(
      (file) =>
        /SITE_TOKEN/.test(read(file)) || /preferences-api/.test(read(file)),
    );

    assert.deepEqual(offenders, [], "only app/ and lib/ may reach the API's token");
  });

  test("a page never calls the API itself", () => {
    const offenders = sourceFiles("app/(site)").filter((file) =>
      /preferences-api/.test(read(file)),
    );

    assert.deepEqual(offenders, [], "the saved search is read through app/api/preferences");
  });
});
