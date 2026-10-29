"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { startSignIn, startSignUp } from "@/lib/auth-actions";

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

// The placement decides the shape: the header has room for two buttons side by side, and the phone
// menu keeps the same rows as the links above it, one under the other.
export function AccountControls({ variant }: { variant: "header" | "menu" | "nav" }) {
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

  const inMenu = variant === "menu";
  // The menu's own links are rows of text, so an action there is a row too.
  const menuRow =
    "flex min-h-11 w-full items-center text-base text-ink no-underline hover:text-ink";
  const primaryClass =
    "inline-flex h-11 items-center rounded-md bg-primary px-3 text-sm font-semibold text-on-primary hover:bg-primary-hover";
  const secondaryClass =
    "inline-flex h-11 items-center rounded-md border border-field bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-muted";
  const textLink = "text-sm text-ink-muted underline hover:border-primary hover:text-ink";

  const wrapper =
    variant === "header" ? "hidden sm:block" : variant === "menu" ? "" : "flex items-center";

  if (state.status === "loading" || state.status === "unconfigured") return null;

  if (state.status === "signed-in") {
    return (
      <div className={wrapper}>
        <div className={inMenu ? "flex flex-col" : "flex flex-wrap items-center gap-2"}>
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
          {/* A link, not a prefetched route: /sign-out destroys this session and leaves for
              Cognito, so Next must not follow it just because it scrolled into view. */}
          <Link
            href="/sign-out"
            prefetch={false}
            className={inMenu ? menuRow : `${secondaryClass} no-underline`}
          >
            Log out
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapper}>
      <div className={inMenu ? "flex flex-col" : "flex flex-wrap items-center gap-2"}>
        <form action={startSignIn}>
          <button type="submit" className={inMenu ? `${menuRow} text-left` : secondaryClass}>
            Log in
          </button>
        </form>
        <form action={startSignUp}>
          <button type="submit" className={inMenu ? `${menuRow} text-left` : primaryClass}>
            Create account
          </button>
        </form>
        {/* Cognito's sign-up page cannot link to our notice, so the notice is reachable from the
            place where an account is made. The header is too tight to carry it. */}
        {variant !== "header" && (
          <Link
            href="/privacy"
            className={inMenu ? `${menuRow} text-sm text-ink-muted underline` : textLink}
          >
            How we use your details
          </Link>
        )}
      </div>
    </div>
  );
}
