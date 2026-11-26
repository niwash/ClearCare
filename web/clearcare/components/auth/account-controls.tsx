"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { signOut, startSignIn, startSignUp } from "@/lib/auth-actions";

// The signed-in or signed-out controls.
//
// The session is read in the browser, from the route Auth.js already serves, rather than in the
// page. Three things follow: the pages stay static, because a server read makes every page that
// shows the header render per request and a page prerendered before the variables existed would
// never show the controls at all; the header is the same on every page; and that route re-signs
// the cookie on each visit, which is what keeps the seven-day limit an idle one.
//
// The header renders these controls three times, so the three would each ask for the session at
// once. This holds the request they share while it is in flight and drops it once it settles, so a
// later page load asks again and nothing stale survives a sign-out.
type SessionState =
  | { status: "unconfigured" }
  | { status: "signed-out" }
  | { status: "signed-in"; email: string };

let inFlight: Promise<SessionState> | null = null;

function readSession(): Promise<SessionState> {
  inFlight ??= fetch("/api/auth/session", { cache: "no-store" })
    .then(async (response): Promise<SessionState> => {
      // The route answers 503 while the variables are missing, so the site says nothing about
      // accounts rather than offering a control that cannot work.
      if (!response.ok) return { status: "unconfigured" };
      const session = (await response.json()) as { user?: { email?: string } };
      const email = session?.user?.email;
      return email ? { status: "signed-in", email } : { status: "signed-out" };
    })
    .catch((): SessionState => ({ status: "unconfigured" }))
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

// The session, for each control that needs its own answer. The shared request above means the
// header's controls cost one call between them however many are rendered.
function useSession() {
  const [state, setState] = useState<SessionState | { status: "loading" }>({ status: "loading" });

  useEffect(() => {
    let live = true;
    readSession().then((result) => {
      if (live) setState(result);
    });
    return () => {
      live = false;
    };
  }, []);

  return state;
}

// The placement decides the shape: the header and the nav band have one button for signing in or
// up, and the phone menu keeps the same rows as the links above it, one under the other.
export function AccountControls({ variant }: { variant: "header" | "menu" | "nav" }) {
  const state = useSession();

  const inMenu = variant === "menu";
  // The menu's own links are rows of text, so an action there is a row too.
  const menuRow =
    "flex min-h-11 w-full items-center text-base text-ink no-underline hover:text-ink";
  const primaryClass =
    "inline-flex h-11 items-center rounded-md bg-primary px-3 text-sm font-semibold text-on-primary hover:bg-primary-hover";
  const secondaryClass =
    "inline-flex h-11 items-center rounded-md border border-field bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-muted";

  const wrapper =
    variant === "header" ? "hidden sm:block" : variant === "menu" ? "" : "flex items-center";
  // In the nav band they stay on one line with its links: wrapping there stacked them, and the band
  // grew to three rows' height with nothing but white space under the links.
  const row = variant === "nav" ? "flex items-center gap-2" : "flex flex-wrap items-center gap-2";

  if (state.status === "loading" || state.status === "unconfigured") return null;

  if (state.status === "signed-in") {
    return (
      <div className={wrapper}>
        <div className={inMenu ? "flex flex-col" : row}>
          <span
            className={
              inMenu
                ? "flex min-h-11 items-center text-base text-ink-muted"
                : "text-sm font-semibold text-ink"
            }
            title="You are signed in"
          >
            {state.email}
          </span>
          {/* A form action, so the browser cannot be sent here by another site, and Auth.js clears
              its own cookies with the options it set them with. */}
          <form action={signOut}>
            <button type="submit" className={inMenu ? `${menuRow} text-left` : secondaryClass}>
              Log out
            </button>
          </form>
        </div>
      </div>
    );
  }

  // One button in the header and the nav band, which had grown crowded (P2_6, CCARE-318). It opens
  // Cognito's sign-in page, which links to its sign-up page, so the one button serves both. The
  // phone menu has a row to spare for each, and for the privacy notice.
  if (!inMenu) {
    return (
      <div className={wrapper}>
        <form action={startSignIn}>
          <button type="submit" className={`${primaryClass} whitespace-nowrap`}>
            Log in / Sign up
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={wrapper}>
      <div className="flex flex-col">
        <form action={startSignIn}>
          <button type="submit" className={`${menuRow} text-left`}>
            Log in
          </button>
        </form>
        <form action={startSignUp}>
          <button type="submit" className={`${menuRow} text-left`}>
            Create account
          </button>
        </form>
        {/* Cognito's sign-up page cannot link to our notice, so the notice is reachable from the
            place where an account is made. The header is too tight to carry it. */}
        <Link href="/privacy" className={`${menuRow} text-sm text-ink-muted underline`}>
          How we use your details
        </Link>
      </div>
    </div>
  );
}

// "Your alerts" beside Your shortlist (CCARE-271), in the header's top band on every width, and in
// the shortlist button's outlined shape without a count: there is nothing to count. It sits here
// rather than with the account controls so it keeps one place on every page; signed out it shows
// nothing, since an alert belongs to an account, and a home's page carries the sign-in offer.
export function AlertsButton() {
  const state = useSession();
  if (state.status !== "signed-in") return null;

  return (
    <Link
      href="/alerts"
      className="flex h-11 shrink-0 items-center whitespace-nowrap rounded-md border border-line px-3 text-sm font-semibold text-ink-muted no-underline hover:text-ink hover:no-underline"
    >
      {/* Shorter on phones, as the shortlist's label is, so both fit beside the display buttons. */}
      <span className="sm:hidden">Alerts</span>
      <span className="max-sm:hidden">Your alerts</span>
    </Link>
  );
}
