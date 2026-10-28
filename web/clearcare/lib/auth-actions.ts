"use server";

import { redirect } from "next/navigation";

import { authConfigured, authRuntime } from "@/lib/auth";
import { safeReturnPath } from "@/lib/return-to";

// The sign-in and create-account pages post here, so the return path is validated on the server
// rather than trusted from the form.
export async function startSignIn(formData: FormData): Promise<void> {
  if (!authConfigured()) redirect("/login");

  const returnTo = safeReturnPath(formData.get("returnTo")?.toString());
  await authRuntime().signIn("cognito", { redirectTo: returnTo });
}

// Clears the ClearCare session. Ending Cognito's hosted session as well is a later ticket.
export async function endSession(): Promise<void> {
  if (!authConfigured()) redirect("/");

  await authRuntime().signOut({ redirectTo: "/" });
}
