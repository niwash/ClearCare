"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authRuntime } from "@/lib/auth";
import { authConfigured } from "@/lib/auth-config";
import { DEFAULT_RETURN_TO, safeReturnPath } from "@/lib/return-to";

// The page a visitor came from. A form posts to the URL it is on, so the browser's Referer names
// that page, and reading it here is what lets the controls carry no query string of their own.
// A Referer that is missing (a privacy setting or a proxy) falls back to the home page rather than
// dropping the visitor somewhere arbitrary.
async function returnFromReferer(): Promise<string> {
  const referer = (await headers()).get("referer");
  if (!referer) return DEFAULT_RETURN_TO;

  try {
    const url = new URL(referer);
    return safeReturnPath(`${url.pathname}${url.search}`);
  } catch {
    return DEFAULT_RETURN_TO;
  }
}

// The account controls post here. Cognito's authorize endpoint always opens the sign-in page, so
// creating an account goes through a provider whose entry page is the hosted /signup page.
async function start(provider: string): Promise<void> {
  if (!authConfigured()) redirect("/");

  await authRuntime().signIn(provider, { redirectTo: await returnFromReferer() });
}

export async function startSignIn(): Promise<void> {
  await start("cognito");
}

export async function startSignUp(): Promise<void> {
  await start("cognito-signup");
}

// Clears the ClearCare session. Ending Cognito's hosted session as well is a later ticket.
export async function endSession(): Promise<void> {
  if (!authConfigured()) redirect("/");

  await authRuntime().signOut({ redirectTo: "/" });
}
