import type { Metadata } from "next";

import { AccountEntry } from "@/components/auth/account-entry";
import { startSignIn } from "@/lib/auth-actions";
import { authConfigured } from "@/lib/auth";
import { safeReturnPath } from "@/lib/return-to";

export const metadata: Metadata = {
  title: "Log in · ClearCare",
  description: "Log in to ClearCare.",
};

// Where the header's "Log in" leads. Accounts are optional, so the page says so and then hands the
// visitor to Cognito, which owns the password and offers "Sign up" and "Forgot password" itself.
// This page sits outside the (site) group, as main put it: it has no header or footer of its own.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 md:px-8 md:py-12">
      <AccountEntry
        intent="sign-in"
        configured={authConfigured()}
        returnTo={safeReturnPath(returnTo)}
        action={startSignIn}
      />
    </main>
  );
}
