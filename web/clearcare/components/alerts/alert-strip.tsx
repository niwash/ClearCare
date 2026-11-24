"use client";

// components/alerts/alert-strip.tsx
// The offer to receive alerts, on a home's page, on a search filtered to a county, and on a search
// of its own (CCARE-271): one home, one county, or every report on the site.
// One strip, two states: the offer, then "You receive alerts" with Stop. The page reads the
// account's subscriptions on the server, so a visitor who already follows this target sees the
// second state on the first draw, before any click.
//
// The colours are the site's tint-blue panel, as "Planning a visit?" uses at the foot of a home's
// page, so the strip reads as part of the page rather than as a banner. On phones the words and the
// button stack, and the button is the full width of the strip. Compact, in a home's column of actions
// (CCARE-297), they stack at every width, as the column is a phone's width.
//
// Signed out, the button is the site's own sign-in action: a form, so the browser cannot be sent
// here by another site, and the visitor comes back to this page afterwards (the action returns them
// to their Referer). A session that expires while the page is open is answered the same way.
import Link from "next/link";
import { useId, useState } from "react";

import { Icon } from "@/components/ui/icons";
import { countyId } from "@/lib/alerts";
import { startSignIn } from "@/lib/auth-actions";

export type AlertStripTarget =
  | { kind: "centre"; centreId: string }
  | { kind: "county"; county: string }
  // Every report on the site, from the search page when no county narrows it.
  | { kind: "all" };

const OFFER_CLASS =
  "inline-flex min-h-11 w-full shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60 adult:rounded-md";
const QUIET_CLASS =
  "inline-flex min-h-11 w-full shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-line bg-surface px-5 font-semibold text-ink hover:bg-surface-muted disabled:opacity-60 adult:rounded-md";

export function AlertStrip({
  target,
  followedId,
  signedIn,
  compact = false,
}: {
  target: AlertStripTarget;
  // The id of the account's row for this target, from the page's server read, or null.
  followedId: number | null;
  signedIn: boolean;
  // Stacked at every width, for a narrow column.
  compact?: boolean;
}) {
  const headingId = `alert-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [id, setId] = useState<number | null>(followedId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [said, setSaid] = useState("");

  const following = id !== null;
  const county = target.kind === "county" ? target.county : null;
  const targetId = county ? countyId(county) : null;
  // A county the list doesn't know is not one the API would take: the strip stays away.
  if (target.kind === "county" && targetId === null) return null;

  const heading = following
    ? county
      ? `You receive alerts for Co. ${county}`
      : target.kind === "all"
        ? "You receive alerts for every report"
        : "You receive alerts for this home"
    : county
      ? `Hear about new inspection reports in Co. ${county}`
      : target.kind === "all"
        ? "Hear about new inspection reports anywhere in Ireland"
        : "Hear about new inspection reports";
  const caption = following
    ? "We'll email you each time a new report is added."
    : county
      ? `We'll email you an alert each time a new report is added for a home in Co. ${county} on ClearCare.`
      : target.kind === "all"
        ? "We'll email you an alert each time a new report is added for any home on ClearCare."
        : "We'll email you an alert each time a new report is added for this home on ClearCare.";

  // Beside the words from tablet width, unless compact; the button then sizes to its words.
  const wide = compact ? "" : "sm:w-auto";
  const offerClass = `${OFFER_CLASS} ${wide}`;
  const quietClass = `${QUIET_CLASS} ${wide}`;

  async function follow() {
    setBusy(true);
    setError(null);
    try {
      const body =
        target.kind === "centre"
          ? { scope: "centre", centre_id: target.centreId }
          : target.kind === "county"
            ? { scope: "county", county_id: targetId }
            : { scope: "all" };
      const response = await fetch("/api/alerts/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      // The session has gone: the offer becomes the way back in, rather than a dead button.
      if (response.status === 401) {
        setExpired(true);
        return;
      }
      const answer = (await response.json().catch(() => null)) as { subscription?: { id?: unknown }; message?: string } | null;
      const stored = typeof answer?.subscription?.id === "number" ? answer.subscription.id : null;
      if (!response.ok || stored === null) {
        setError(answer?.message ?? "We couldn't save this alert. Please try again.");
        return;
      }
      setId(stored);
      setSaid(`You now receive alerts. ${caption}`);
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (id === null) return;
    // Every report is the broadest target there is, so stopping it stops every alert (CCARE-271):
    // the collection's DELETE empties the account rather than removing this one row. The /alerts
    // list does the same, and both must, or the strip would leave narrower alerts still sending.
    const everything = target.kind === "all";
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(everything ? "/api/alerts/subscriptions" : `/api/alerts/subscriptions/${id}`, {
        method: "DELETE",
      });
      if (response.status === 401) {
        setExpired(true);
        return;
      }
      // 204 is the only success: the API answers it even for a row already gone.
      if (!response.ok) {
        const answer = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(answer?.message ?? "We couldn't stop this alert. Please try again.");
        return;
      }
      setId(null);
      setSaid(everything ? "You've stopped all your alerts." : "You no longer receive alerts for this.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby={headingId}
      className={`flex flex-col gap-4 rounded-2xl bg-tint-blue p-5 text-on-tint-blue adult:rounded-lg adult:border adult:border-line ${
        compact ? "" : "sm:flex-row sm:items-center sm:justify-between md:p-6"
      }`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-ink">
          <Icon name={following ? "results" : "bell"} className="size-4" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className={`font-heading text-lg font-semibold ${compact ? "" : "sm:text-xl"}`}>
            {heading}
          </h2>
          <p className={`text-sm ${compact ? "" : "sm:text-base"}`}>{caption}</p>
          {following && (
            <Link href="/alerts" className="tap-target text-sm font-semibold underline">
              Manage alerts
            </Link>
          )}
          {error && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          )}
        </div>
      </div>

      <span role="status" className="sr-only">
        {said}
      </span>

      {!signedIn || expired ? (
        <form action={startSignIn} className="shrink-0">
          <button type="submit" className={offerClass}>
            Sign in to get alerts
          </button>
        </form>
      ) : following ? (
        <button
          type="button"
          onClick={stop}
          disabled={busy}
          className={quietClass}
          aria-label={target.kind === "all" ? "Stop all your alerts" : undefined}
        >
          {busy ? "Stopping…" : target.kind === "all" ? "Stop all" : "Stop"}
        </button>
      ) : (
        <button type="button" onClick={follow} disabled={busy} className={offerClass}>
          {busy ? "Saving…" : "Get alerts"}
        </button>
      )}
    </section>
  );
}
