"use client";

// components/alerts/unsubscribe-confirm.tsx
// The page an email's unsubscribe link opens (CCARE-271). It asks before anything changes: opening
// the link only draws this, and the POST that stops every alert is sent when the visitor presses the
// button (ADR-0034). A mail client or a link scanner that opens the page changes nothing.
//
// The token travels from the page's own address, and is sent straight back to app/api/alerts/
// unsubscribe. It is a capability rather than personal data, and it is never shown.
import Link from "next/link";
import { useState } from "react";

import { Icon, type IconName } from "@/components/ui/icons";

type State = "asking" | "sending" | "done" | "gone" | "failed";

const DANGER_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-danger bg-surface px-5 font-semibold text-danger hover:bg-surface-muted disabled:opacity-60 adult:rounded-md";
const PRIMARY_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 font-semibold text-on-primary no-underline hover:bg-primary-hover adult:rounded-md";

export function UnsubscribeConfirm({ token }: { token: string | null }) {
  const [state, setState] = useState<State>(token ? "asking" : "gone");
  const [detail, setDetail] = useState<string | null>(null);

  async function stop() {
    if (!token) return;
    setState("sending");
    setDetail(null);
    try {
      const response = await fetch(`/api/alerts/unsubscribe?token=${encodeURIComponent(token)}`, { method: "POST" });
      if (response.ok) {
        setState("done");
        return;
      }
      if (response.status === 404) {
        setState("gone");
        return;
      }
      const answer = (await response.json().catch(() => null)) as { message?: string } | null;
      setDetail(answer?.message ?? null);
      setState("failed");
    } catch {
      setState("failed");
    }
  }

  const icon: IconName = state === "done" ? "results" : state === "gone" || state === "failed" ? "info" : "email";

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-8 text-center md:px-8 adult:rounded-lg">
      <span
        aria-hidden
        className={`grid size-11 place-items-center rounded-full ${
          state === "done" ? "bg-tint-sage text-on-tint-sage" : "bg-tint-blue text-on-tint-blue"
        }`}
      >
        <Icon name={icon} className="size-5" />
      </span>

      {state === "done" ? (
        <>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">You have stopped all alerts</h1>
          <p className="text-ink-muted">
            This address won&apos;t receive ClearCare alerts unless someone follows a home or a county again.
          </p>
          <Link href="/search" className={PRIMARY_CLASS}>
            Search nursing homes
          </Link>
        </>
      ) : state === "gone" ? (
        <>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">This link has expired</h1>
          <p className="text-ink-muted">
            It may already have been used. You can stop any alert at any time from{" "}
            <Link href="/alerts" className="text-ink">
              your alerts
            </Link>
            .
          </p>
          <Link href="/" className={PRIMARY_CLASS}>
            Back to ClearCare
          </Link>
        </>
      ) : (
        <>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Stop all ClearCare alerts?</h1>
          <p className="text-ink-muted">
            This stops every alert for this address, including the homes and counties you follow.
          </p>
          <div className="flex flex-col items-center gap-2 sm:flex-row">
            <button type="button" onClick={stop} disabled={state === "sending"} className={DANGER_CLASS}>
              {state === "sending" ? "Stopping…" : "Yes, stop all alerts"}
            </button>
            <Link href="/" className="tap-target px-2 text-ink-muted underline">
              Keep my alerts
            </Link>
          </div>
          {state === "failed" && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {detail ?? "We couldn't stop your alerts just now. Please try again."}
            </p>
          )}
        </>
      )}
    </section>
  );
}
