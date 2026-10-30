import type { Metadata } from "next";
import Link from "next/link";
import { actionLinkClass, comingSoonClass } from "@/components/ui/classes";

export const metadata: Metadata = {
  title: "Log in · ClearCare",
  description: "Log in to ClearCare.",
};

// Where the header's "Log in" leads, kept for when accounts exist. Until then it says so and
// sends people to the start page; everything on the site works without an account.
export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Welcome to ClearCare</h1>
      <p className="mb-6 max-w-md">
        Accounts are coming soon. You don&rsquo;t need one to use ClearCare: you can search for homes, read their
        inspection reports and use the guides without logging in.
      </p>
      {/* Continue as guest is the only thing that works yet, so it's the filled button. */}
      <Link href="/" className={`${actionLinkClass} w-64 justify-center`}>
        Continue as guest
      </Link>
      {/* A disabled button, so screen readers announce it as an unavailable control. */}
      <button
        type="button"
        disabled
        className={`flex h-12 w-64 items-center justify-center font-semibold ${comingSoonClass}`}
      >
        Log in (coming soon)
      </button>
      {/* Accounts collect an email address, so the notice is linked where they'll be made (GDPR Art. 13). */}
      <p className="mt-4 max-w-md text-sm text-ink-muted">
        Read how we&rsquo;ll use your details in our{" "}
        <Link href="/privacy" className="inline-block py-1 tap-target">
          privacy notice
        </Link>
        .
      </p>
    </main>
  );
}
