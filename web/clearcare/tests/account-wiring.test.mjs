// tests/account-wiring.test.mjs
// The account controls are components, and this runner loads no JSX, so the wiring
// is checked by reading the source the way the breadcrumb test does: the header has
// to pass the page the visitor is on into a sign-in or sign-out action, and there
// must be no page of our own between the click and Cognito. Run with: npm test
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";

const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const present = (path) => existsSync(new URL(`../${path}`, import.meta.url));

test("the header and the phone menu both show the account controls", () => {
  const header = source("components/layout/site-header.tsx");

  assert.match(header, /<AccountControls variant="header" \/>/);
  assert.match(header, /<AccountControls variant="menu" \/>/);
  // The adult-centred design hides the header button and has no menu, so the nav band carries it.
  assert.match(header, /<AccountControls variant="nav" \/>/);
  // useSearchParams in the controls needs a Suspense boundary on a static page.
  assert.equal(header.match(/<Suspense fallback=\{null\}>/g)?.length, 3);
  assert.doesNotMatch(header, /href[:=]\s*"\/login"/);
});

test("each control submits to the page it names", () => {
  const controls = source("components/auth/account-controls.tsx");
  const view = source("components/auth/account-controls-view.tsx");

  assert.match(controls, /signInAction=\{startSignIn\}/);
  assert.match(controls, /signUpAction=\{startSignUp\}/);
  // One form each, and both carry the page the visitor is on.
  assert.equal(view.match(/<form action=\{signInAction\}>/g)?.length, 1);
  assert.equal(view.match(/<form action=\{signUpAction\}>/g)?.length, 1);
  assert.equal(view.match(/name="returnTo"/g)?.length, 2);
  assert.doesNotMatch(view, /href=\{`\/login/);
  assert.doesNotMatch(view, /href=\{`\/sign-up/);
  // The phone menu keeps its own row shape rather than dropping bordered buttons into the list.
  assert.match(controls, /variant=\{variant\}/);
  assert.match(view, /const menuRow =[\s\S]*min-h-11/);
  assert.match(view, /inMenu \? `\$\{menuRow\} text-left` : secondaryClass/);
});

test("creating an account enters Cognito at the sign-up page, not the sign-in page", () => {
  const config = source("lib/auth.ts");
  const actions = source("lib/auth-actions.ts");

  // Cognito's authorize endpoint always opens /login, so the provider names /signup directly.
  assert.match(config, /id: "cognito-signup"/);
  assert.match(config, /url: `\$\{env\.COGNITO_DOMAIN\.trim\(\)\}\/signup`/);
  assert.match(actions, /startSignUp[\s\S]*"cognito-signup"/);
  // That provider's callback has to be registered on the app client or Cognito refuses it.
  const development = source("../../infra/aws/cognito/development/main.tf");
  assert.match(development, /\$\{var\.web_origin\}\/api\/auth\/callback\/cognito-signup/);
});

test("the controls sign out through the session action, not a link to Cognito", () => {
  const controls = source("components/auth/account-controls.tsx");
  const view = source("components/auth/account-controls-view.tsx");

  assert.match(controls, /signOutAction=\{endSession\}/);
  assert.match(view, /<form action=\{signOutAction\}>/);
  assert.doesNotMatch(view, /href="\/sign-out"/);
});

test("no page of our own sits between the visitor and Cognito", () => {
  assert.equal(present("app/login/page.tsx"), false);
  assert.equal(present("app/sign-up/page.tsx"), false);
  assert.equal(present("components/auth/account-entry.tsx"), false);
  // The sign-in action falls back to the start page, which is the only one left.
  assert.doesNotMatch(source("lib/auth-actions.ts"), /redirect\("\/login"\)/);
});
