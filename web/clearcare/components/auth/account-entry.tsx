import Link from "next/link";

import { primaryButtonClass } from "@/components/ui/classes";

// The body of the /login and /sign-up pages. ClearCare never shows a password field: the visitor is handed
// to Cognito's managed login page, which also offers "Sign up" and "Forgot password".
export function AccountEntry({
  intent,
  configured,
  returnTo,
  action,
}: {
  intent: "sign-in" | "sign-up";
  configured: boolean;
  returnTo: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const signingIn = intent === "sign-in";

  return (
    <section aria-labelledby="account-heading" className="mx-auto w-full max-w-2xl">
      <h1 id="account-heading" className="font-heading text-3xl font-semibold tracking-tight">
        {signingIn ? "Log in to ClearCare" : "Create a ClearCare account"}
      </h1>

      <p className="mt-4 text-ink-muted">
        An account is optional. Everything ClearCare publishes about nursing homes stays free to
        read without one, and you can keep browsing as a guest.
      </p>

      <p className="mt-3 text-ink-muted">
        {signingIn
          ? "Signing in takes you to our identity provider, Amazon Cognito, where your email address and password are handled."
          : "Creating an account also happens with our identity provider, Amazon Cognito. Choose Sign up on their page, confirm your email address, and then sign in."}
      </p>

      <p className="mt-3 text-sm text-ink-muted">
        <Link href="/privacy" className="font-semibold text-primary underline">
          How ClearCare uses your details
        </Link>
      </p>

      {configured ? (
        <form action={action} className="mt-8">
          {/* Validated again on the server before it is used for the redirect. */}
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" className={primaryButtonClass}>
            {signingIn ? "Continue to Cognito" : "Create an account with Cognito"}
          </button>
        </form>
      ) : (
        <div role="status" className="mt-8 rounded-md border border-line bg-surface-muted p-4">
          <h2 className="font-semibold text-ink">Sign-in is not available here</h2>
          <p className="mt-2 text-ink-muted">
            This copy of ClearCare has no identity provider configured, so accounts cannot be used.
            Every public page still works without one.
          </p>
          <Link href="/" className="mt-3 inline-block font-semibold text-primary underline">
            Continue as a guest
          </Link>
        </div>
      )}
    </section>
  );
}
