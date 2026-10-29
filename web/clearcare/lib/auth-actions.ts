"use server";

import { redirect } from "next/navigation";

import { authRuntime } from "@/lib/auth";
import { authConfigured } from "@/lib/auth-config";
import { safeReturnPath } from "@/lib/return-to";

// The account controls post here, so the return path is validated on the server rather than
// trusted from the form. Cognito's authorize endpoint always opens the sign-in page, so creating
// an account goes through a provider whose entry page is the hosted /signup page.
async function start(formData: FormData, provider: string): Promise<void> {
  if (!authConfigured()) redirect("/");

  const returnTo = safeReturnPath(formData.get("returnTo")?.toString());
  await authRuntime().signIn(provider, { redirectTo: returnTo });
}

export async function startSignIn(formData: FormData): Promise<void> {
  await start(formData, "cognito");
}

export async function startSignUp(formData: FormData): Promise<void> {
  await start(formData, "cognito-signup");
}

// Clears the ClearCare session. Ending Cognito's hosted session as well is a later ticket.
export async function endSession(): Promise<void> {
  if (!authConfigured()) redirect("/");

  await authRuntime().signOut({ redirectTo: "/" });
}
