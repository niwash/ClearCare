import type { Metadata } from "next";

import { AccountEntry } from "@/components/auth/account-entry";
import { startSignIn } from "@/lib/auth-actions";
import { authConfigured } from "@/lib/auth";
import { safeReturnPath } from "@/lib/return-to";

export const metadata: Metadata = {
  title: "Create an account · ClearCare",
  description: "Create a ClearCare account.",
};

// The second entry point, beside the header's Log in. Cognito's page carries the Sign up choice as
// well, so this exists to say what an account is for before sending the visitor there.
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 md:px-8 md:py-12">
      <AccountEntry
        intent="sign-up"
        configured={authConfigured()}
        returnTo={safeReturnPath(returnTo)}
        action={startSignIn}
      />
    </main>
  );
}
