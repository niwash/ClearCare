"use client";

// components/centre/centre-tabs.tsx
// The record's pages as folder tabs under the home's name (CCARE-212): the overview, and a subpage
// for each long section, which replaced one long page and its sticky section menu. Each tab is a
// link to a page of its own, so Back, sharing and bookmarks work.
//
// Like the tabs on a folder: every tab is outlined with rounded top corners. The current one is in
// the colour of the band its page starts with, lifted by a shadow, and has no line under it, so it
// runs into that band; the others are on a muted fill behind the row's line. So the current tab
// shows by shape as well as colour, and aria-current says so to screen readers. All are the same
// height, so nothing in the row moves when the current one changes. On narrow screens the row
// scrolls sideways.
//
// The pages are fetched ahead in full, so a tab usually opens at once, its page sliding in from the
// tab's side (template.tsx). A tab clicked before its page has arrived is shown as the current one
// at once, with a spinner after a moment, until the page comes. The window stays where it is, as
// with tabs on one page, rather than jumping to the page's top.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// band: the background class of the band the page starts with (Band in centre-band.tsx), written
// out in full so Tailwind finds it.
export type CentreTab = { href: string; label: string; band: string };

export function CentreTabs({ tabs }: { tabs: CentreTab[] }) {
  const pathname = usePathname();
  // The tab clicked, until its page is the one shown. Kept with the path it was clicked on, so it
  // lapses by itself once the path changes, and Back or a link elsewhere isn't overridden by it.
  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  const waiting = clicked && clicked.from === pathname && clicked.href !== pathname ? clicked.href : null;
  const shown = waiting ?? pathname;
  return (
    <nav aria-label="This home's record" aria-busy={waiting ? true : undefined} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      {/* The row's line is the bottom edge of the folder's back; the current tab covers it. */}
      <ul className="flex min-w-max items-end gap-1.5 border-b border-line pt-1">
        {tabs.map((tab) => {
          const current = shown === tab.href;
          return (
            // Every tab overlaps the row's line by its own bottom pixel, the current one with no line
            // there so it runs into the band, the others drawing the line themselves. So no tab moves
            // when the current one changes.
            <li key={tab.href} className={`relative -mb-px ${current ? "z-10" : ""}`}>
              <Link
                href={tab.href}
                // The whole page, data and all, fetched ahead while the record is open, not only the
                // loading outline: each page reads the record from the API afresh, which takes a few
                // tenths of a second, so a tab opens at once instead of after that wait.
                prefetch
                scroll={false}
                aria-current={pathname === tab.href ? "page" : undefined}
                onClick={(event) => {
                  // A new tab or window, opened with a modifier key, leaves this page as it is.
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  setClicked({ href: tab.href, from: pathname });
                }}
                className={`folder-tab relative flex min-h-12 items-center rounded-t-xl border border-line px-4 font-semibold no-underline adult:rounded-t-md md:px-5 ${
                  current
                    ? `${tab.band} border-b-transparent text-ink shadow-[0_-2px_6px_rgb(0_0_0/0.06)]`
                    : "bg-surface-muted text-ink-muted hover:bg-surface hover:text-ink adult:underline"
                }`}
              >
                {tab.label}
                {/* In the tab's padding, out of the row's layout, so it doesn't widen the tab. */}
                {waiting === tab.href && (
                  <span
                    aria-hidden
                    className="loading-spinner absolute top-1/2 right-1 -mt-1.5 size-3 rounded-full border-2 border-current border-t-transparent md:right-1.5"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
