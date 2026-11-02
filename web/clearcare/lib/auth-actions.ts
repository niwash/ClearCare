"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authRuntime } from "@/lib/auth";
import { authConfigured } from "@/lib/auth-config";
import { cognitoLogoutUrl } from "@/lib/cognito-logout";
import { originFrom } from "@/lib/request-origin";
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

// Signs out of ClearCare and then of Cognito. Auth.js writes each deletion cookie with the options
// the cookie was set with, which an __Secure- or __Host- cookie needs: a bare delete would be
// ignored over HTTPS and the visitor would come back to a page that still shows them signed in.
// Being a form action also means another site cannot sign someone out by linking to it.
export async function signOut(): Promise<void> {
  await authRuntime().signOut({ redirect: false });

  const current = await headers();
  const origin = originFrom({
    "x-forwarded-host": current.get("x-forwarded-host"),
    "x-forwarded-proto": current.get("x-forwarded-proto"),
    host: current.get("host"),
  });

  redirect(cognitoLogoutUrl(process.env, origin) ?? "/");
}
