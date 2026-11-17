"use client";

// components/centre/centre-tabs.tsx
// The record's pages as folder tabs under the home's name (CCARE-212): the overview, and a subpage
// for each long section, which replaced one long page and its sticky section menu. Each tab is a
// link to a page of its own, so Back, sharing and bookmarks work.
//
// Like the tabs on a folder: every tab is outlined with rounded top corners. The current one is in
// the colour of the band its page starts with, lifted by a shadow, and has no line under it, so it
// runs into that band; the others sit behind the row's line. Since CCARE-258 every tab has its page's
// colour (below), so the current one shows by shape: taller, in front and open at the foot; and
// aria-current says so to screen readers. Tabs keep their widths, so only the current tab's top moves
// when it changes. On narrow screens the row scrolls sideways.
//
// The pages are fetched ahead in full, so a tab usually opens at once, its page sliding in from the
// tab's side (template.tsx). A tab clicked before its page has arrived is shown as the current one
// at once, with a spinner after a moment, until the page comes. The window stays where it is, as
// with tabs on one page, rather than jumping to the page's top.
//
// Where the row scrolls, the current tab is scrolled into the middle of it when a page opens, so
// arriving at What to ask from a link elsewhere doesn't leave its tab off-screen. Only the row
// scrolls, not the window.
//
// Made to stand out (CCARE-258): in user testing (P2_1) the participant didn't notice the tabs at
// first, and kept scrolling down and forgetting they were there. So every tab is in the colour of the
// band its page starts with, as a folder's dividers are coloured, rather than only the current one,
// with the others on a muted fill and faded text. The current tab still shows by shape: a little
// taller than the others, in front with its shadow, and with no line under it, so it runs into its
// band. The others lift a little on hover, like a divider's tab pulled up.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

  const row = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = row.current;
    const tab = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !tab) return;
    const navBox = nav.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    // Left alone when it's already in full view, so moving between visible tabs doesn't shift the row.
    if (tabBox.left >= navBox.left && tabBox.right <= navBox.right) return;
    nav.scrollLeft += tabBox.left - navBox.left - (navBox.width - tabBox.width) / 2;
  }, [pathname]);

  return (
    <nav ref={row} aria-label="This home's record" aria-busy={waiting ? true : undefined} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      {/* The row's line is the bottom edge of the folder's back; the current tab covers it. */}
      <ul className="flex min-w-max items-end gap-1.5 border-b border-ink/40 pt-1.5 adult:border-line">
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
                // Every tab in its page's colour, outlined in 40% of the text colour, which shows on
                // every tint (the site's soft line didn't), as does the row's line; the current tab has
                // no bottom edge, so it opens into its band. The current one taller (the row lines its tabs up
                // at the bottom, so only its top rises), in front and open at the foot; the others
                // lifted 2px on hover, which the row's top padding has room for.
                className={`folder-tab relative flex items-center rounded-t-xl border border-ink/40 px-4 font-semibold text-ink no-underline adult:rounded-t-md md:px-5 ${tab.band} ${
                  current
                    ? "min-h-13 border-b-transparent shadow-[0_-2px_6px_rgb(0_0_0/0.08)]"
                    : "min-h-11 hover:-translate-y-0.5 hover:border-primary hover:text-ink motion-reduce:hover:translate-y-0 adult:underline adult:hover:translate-y-0"
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
