"use client";

// components/alerts/alerts-list.tsx
// The /alerts page's list (CCARE-271): every alert the account receives, each with Stop. Alerts are
// started where the target is: a home's page, a search filtered to a county, or the search page for
// every report; this page only shows and stops them.
//
// The page hands over what it read on the server, so the list is right on the first draw. A stop goes
// to app/api/alerts and the row goes without a reload; it answers 204 whether or not the row was
// still there, so rows are matched by id.
import Link from "next/link";
import { useState } from "react";

import { Icon, type IconName } from "@/components/ui/icons";

export type AlertRowKind = "centre" | "county" | "all";

export type AlertRow = {
  id: number;
  kind: AlertRowKind;
  // What the row names: a home, "Co. Cork", or "Every report".
  label: string;
  caption: string;
  href: string | null;
};

const ICONS: Record<AlertRowKind, IconName> = { centre: "home", county: "address", all: "website" };

const STOP_CLASS =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-muted disabled:opacity-60 adult:rounded-md";

export function AlertsList({ initial }: { initial: AlertRow[] }) {
  const [rows, setRows] = useState<AlertRow[]>(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState("");

  async function stop(row: AlertRow) {
    // Every report is the broadest target there is, so stopping it stops every alert (CCARE-271):
    // the collection's DELETE empties the account rather than removing one row.
    const everything = row.kind === "all";
    setBusy(row.id);
    setError(null);
    try {
      const response = await fetch(everything ? "/api/alerts/subscriptions" : `/api/alerts/subscriptions/${row.id}`, {
        method: "DELETE",
      });
      // 204 whether or not a row was still there, so the list always agrees with the API.
      if (!response.ok) {
        const answer = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(answer?.message ?? "We couldn't stop that alert. Please try again.");
        return;
      }
      setRows((current) => (everything ? [] : current.filter((each) => each.id !== row.id)));
      setSaid(everything ? "You've stopped all your alerts." : `You no longer receive alerts for ${row.label}.`);
    } finally {
      setBusy(null);
    }
  }

  const heading = (text: string) => (
    <h2 className="font-heading text-xl font-semibold md:text-2xl">{text}</h2>
  );

  return (
    <div className="flex max-w-3xl flex-col">
      <span role="status" className="sr-only">
        {said}
      </span>

      {heading("Alerts you receive")}

      <div className="mt-3 rounded-2xl border border-line bg-surface px-4 md:px-5 adult:rounded-lg">
        {rows.length === 0 ? (
          <p className="py-4 text-ink-muted">
            You don&apos;t receive any alerts yet. Get alerts for a home, a county, or every new report added on ClearCare.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 py-3">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-tint-sage text-on-tint-sage">
                  <Icon name={ICONS[row.kind]} className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">
                    {row.href ? (
                      <Link href={row.href} className="text-ink">
                        {row.label}
                      </Link>
                    ) : (
                      row.label
                    )}
                  </span>
                  <span className="text-sm text-ink-muted">{row.caption}</span>
                </div>
                <button
                  type="button"
                  onClick={() => stop(row)}
                  disabled={busy !== null}
                  className={STOP_CLASS}
                  aria-label={row.kind === "all" ? "Stop all your alerts" : undefined}
                >
                  {busy === row.id ? "Stopping…" : row.kind === "all" ? "Stop all" : "Stop"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      <p className="mt-4 text-sm text-ink-muted">
        Stopping Every report, or the link at the foot of any alert email, stops all of them at once, so leaving
        ClearCare is always one click.
      </p>
    </div>
  );
}
