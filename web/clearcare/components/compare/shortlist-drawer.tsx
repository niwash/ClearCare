"use client";

// "Your shortlist" (CCARE-189): a button with the count that opens the shortlist in a panel sliding
// in from the right, as saved items do on shopping sites, so it takes no room on the page. The panel
// is a modal dialog, so focus stays in it and Escape or a click beside it closes it.
//
// Since CCARE-258 there is one panel on every page, in the header (ShortlistPanel), with a button
// for it in the header's top band beside Easier to read, so the shortlist can be opened from
// anywhere. The buttons on the search page, at the top of the results, and on a home's record, under
// its actions, stay, and open the same panel (ShortlistButton), as does each result's "Shortlist full"
// button (openShortlist). One panel, not one per button, so opening it never opens two. On a home's
// record the panel marks that home in the list, from the page's address. It slides in and out
// (shortlist-panel, globals.css) rather than appearing at once.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { homeInPath } from "@/lib/home-address";
import { useEffect, useRef } from "react";
import { compareHref, MAX_COMPARED } from "@/lib/compare";
import { onOpenShortlist, openShortlist, useComparedHomes } from "./compare-store";
import { ShortlistBox } from "./shortlist-box";

// The button. "page": outlined in the primary colour, with a link to Compare Homes beside it once
// the list is full. "header": like the display buttons beside it in the header's top band.
export function ShortlistButton({ variant = "page" }: { variant?: "page" | "header" }) {
  const homes = useComparedHomes();
  const count = homes?.length ?? 0;
  const header = variant === "header";

  return (
    <div className="flex shrink-0 items-center gap-3">
      <button
        type="button"
        onClick={openShortlist}
        aria-haspopup="dialog"
        className={
          header
            ? "flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-line px-3 text-sm font-semibold text-ink-muted hover:text-ink"
            : "flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border-2 border-primary bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-muted adult:rounded-md"
        }
      >
        {/* "Shortlist" on every width (CCARE-318): short enough that on the search page the List /
            Map switch still fits beside it, clear of the Menu button (#182), and the header's
            buttons take less room. */}
        <span>Shortlist</span>
        {/* The count out of the most the shortlist holds, "2/5", in a filled pill as a basket shows
            its items, so a visitor knows the limit before reaching it (CCARE-318). Read out as
            "2 of 5". */}
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-on-primary tabular-nums">
          {homes === null ? "–" : count}
          <span aria-hidden>/{MAX_COMPARED}</span>
          <span className="sr-only"> of {MAX_COMPARED}</span>
        </span>
      </button>
      {!header && homes && count >= MAX_COMPARED && (
        <span className="hidden text-sm text-ink-muted sm:inline">
          Full.{" "}
          <Link href={compareHref(homes.map((home) => home.id))} className="tap-target">
            Compare these {count} →
          </Link>
        </span>
      )}
    </div>
  );
}

// The button on the search page and a home's record, as it was called before the panel moved to
// the header.
export function ShortlistDrawer() {
  return <ShortlistButton />;
}

// The home a record's pages are about, from its address and the tabs under it (CCARE-297).
function currentCentreId(pathname: string) {
  return homeInPath(pathname)?.id;
}

// The panel, once on every page, in the header. Opened by any shortlist button through
// openShortlist.
export function ShortlistPanel() {
  const dialog = useRef<HTMLDialogElement>(null);
  const currentId = currentCentreId(usePathname());

  useEffect(
    () =>
      onOpenShortlist(() => {
        if (!dialog.current?.open) dialog.current?.showModal();
      }),
    [],
  );

  return (
    <dialog
      ref={dialog}
      aria-labelledby="shortlist-h"
      // A click on the backdrop lands on the dialog itself, outside its panel. A link pressed inside
      // it closes it too: the panel lives in the header, so it would otherwise stay open over the
      // page the link goes to.
      onClick={(event) => {
        if (event.target === dialog.current || (event.target as Element).closest("a")) dialog.current?.close();
      }}
      className="shortlist-panel fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-sm border-l border-line bg-surface p-0 text-ink shadow-xl"
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
        <ShortlistBox currentId={currentId} />
      </div>
    </dialog>
  );
}
