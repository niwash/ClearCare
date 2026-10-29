"use client";

import { usePathname, useSearchParams } from "next/navigation";

// The signed-in or signed-out controls. This is a client component only because it has to know
// the page it is on: the header is on every page, and signing in must return the visitor to the
// page they were reading. The session itself is read on the server and passed in as props.
//
// Log in and Create account submit a form rather than following a link, because Auth.js starts a
// sign-in only from a POST. Log in opens Cognito's sign-in page and Create account its sign-up
// page, so the visitor never sees a page of ours, and neither button lands on the wrong one.
//
// The placement decides the shape: the header has room for two buttons side by side, and the phone
// menu keeps the same rows as the links above it, one under the other, rather than drop two
// bordered buttons into a list of text.
export function AccountControlsView({
  email,
  configured,
  signInAction,
  signUpAction,
  signOutAction,
  variant,
}: {
  email: string | null;
  configured: boolean;
  signInAction: (formData: FormData) => Promise<void>;
  signUpAction: (formData: FormData) => Promise<void>;
  signOutAction: () => Promise<void>;
  variant: "header" | "menu" | "nav";
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const returnTo = query ? `${pathname}?${query}` : pathname;

  // Without an identity provider there is nothing to offer, and a dead button would be worse
  // than no button. The account pages explain what is missing.
  if (!configured) return null;

  const inMenu = variant === "menu";

  // The menu's own links are rows of text, so an action there is a row too.
  const menuRow =
    "flex min-h-11 w-full items-center text-base text-ink no-underline hover:text-ink";
  const primaryClass =
    "inline-flex h-11 items-center rounded-md bg-primary px-3 text-sm font-semibold text-on-primary hover:bg-primary-hover";
  const secondaryClass =
    "inline-flex h-11 items-center rounded-md border border-field bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-muted";

  if (email) {
    return (
      <div className={inMenu ? "flex flex-col" : "flex flex-wrap items-center gap-2"}>
        <span
          className={
            inMenu ? "flex min-h-11 items-center text-base text-ink-muted" : "text-sm font-semibold text-ink"
          }
          title="You are signed in"
        >
          {email}
        </span>
        {/* A form action, because signing out clears the server-side session before it redirects. */}
        <form action={signOutAction}>
          <button type="submit" className={inMenu ? `${menuRow} text-left` : secondaryClass}>
            Log out
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={inMenu ? "flex flex-col" : "flex flex-wrap items-center gap-2"}>
      <form action={signInAction}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <button type="submit" className={inMenu ? `${menuRow} text-left` : secondaryClass}>
          Log in
        </button>
      </form>
      <form action={signUpAction}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <button type="submit" className={inMenu ? `${menuRow} text-left` : primaryClass}>
          Create account
        </button>
      </form>
    </div>
  );
}
