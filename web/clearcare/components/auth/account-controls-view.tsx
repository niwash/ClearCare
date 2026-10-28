"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// The signed-in or signed-out controls. This is a client component only because it has to know
// the page it is on: the header is on every page, and signing in must return the visitor to the
// page they were reading. The session itself is read on the server and passed in as props.
export function AccountControlsView({
  email,
  configured,
  signOutAction,
}: {
  email: string | null;
  configured: boolean;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const returnTo = encodeURIComponent(query ? `${pathname}?${query}` : pathname);

  // Without an identity provider there is nothing to offer, and a dead link would be worse than
  // no link. The account pages explain what is missing.
  if (!configured) return null;

  if (email) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink" title="You are signed in">
          {email}
        </span>
        {/* A form action, because signing out clears the server-side session before it redirects. */}
        <form action={signOutAction}>
          <button
            type="submit"
            className="h-11 rounded-md border border-field bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-muted"
          >
            Log out
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/login?returnTo=${returnTo}`}
        className="inline-flex h-11 items-center rounded-md border border-field bg-surface px-3 text-sm font-semibold text-ink no-underline hover:bg-surface-muted hover:text-ink"
      >
        Log in
      </Link>
      <Link
        href={`/sign-up?returnTo=${returnTo}`}
        className="inline-flex h-11 items-center rounded-md bg-primary px-3 text-sm font-semibold text-on-primary no-underline hover:bg-primary-hover hover:text-on-primary"
      >
        Create account
      </Link>
    </div>
  );
}
