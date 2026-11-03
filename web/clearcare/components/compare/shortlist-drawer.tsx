"use client";

// "Your shortlist" on the search page (CCARE-189): a button with the count, at the top of the
// results, that opens the shortlist in a panel sliding in from the right, as saved items do on
// shopping sites. The results stay in sight beside it. The panel is a modal dialog, so focus stays
// in it and Escape or a click beside it closes it. Once the list is full, a link beside the button
// goes to Compare Homes, and each result's "Shortlist full" button opens the panel too (openShortlist).
import Link from "next/link";
import { useEffect, useRef } from "react";
import { compareHref, MAX_COMPARED } from "@/lib/compare";
import { onOpenShortlist, useComparedHomes } from "./compare-store";
import { ShortlistBox } from "./shortlist-box";

export function ShortlistDrawer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const homes = useComparedHomes();
  const count = homes?.length ?? 0;

  useEffect(
    () =>
      onOpenShortlist(() => {
        if (!dialog.current?.open) dialog.current?.showModal();
      }),
    [],
  );

  return (
    <>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          aria-haspopup="dialog"
          className="flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border-2 border-primary bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-muted adult:rounded-md"
        >
          Your shortlist
          {/* The count in a filled circle, as a basket shows its items; read out as "2 of 3". */}
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-on-primary tabular-nums">
            {homes === null ? "–" : count}
            <span className="sr-only"> of {MAX_COMPARED}</span>
          </span>
        </button>
        {homes && count >= MAX_COMPARED && (
          <span className="hidden text-sm text-ink-muted sm:inline">
            Full.{" "}
            <Link href={compareHref(homes.map((home) => home.id))} className="tap-target">
              Compare these {count} →
            </Link>
          </span>
        )}
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="shortlist-h"
        // A click on the backdrop lands on the dialog itself, outside its panel.
        onClick={(event) => event.target === dialog.current && dialog.current.close()}
        className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-sm border-l border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink"
            >
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="size-4">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
              Close
            </button>
          </div>
          <ShortlistBox plain />
        </div>
      </dialog>
    </>
  );
}
