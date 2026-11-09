"use client";

// components/centre/centre-tabs.tsx
// The record's pages as folder tabs under the home's name (CCARE-212): the overview, and a subpage
// for each long section, which replaced one long page and its sticky section menu. Each tab is a
// link to a page of its own, so Back, sharing and bookmarks work.
//
// Like the tabs on a folder: every tab is outlined with rounded top corners. The current one is
// taller, in the colour of the band its page starts with, and has no line under it, so it runs into
// that band; the others sit lower on a muted fill behind the row's line. So the current tab shows
// by shape and size as well as colour, and aria-current says so to screen readers. On narrow
// screens the row scrolls sideways.
import Link from "next/link";
import { usePathname } from "next/navigation";

// band: the background class of the band the page starts with (Band in centre-band.tsx), written
// out in full so Tailwind finds it.
export type CentreTab = { href: string; label: string; band: string };

export function CentreTabs({ tabs }: { tabs: CentreTab[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="This home's record" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      {/* The row's line is the bottom edge of the folder's back; the current tab covers it. */}
      <ul className="flex min-w-max items-end gap-1.5 border-b border-line pt-1">
        {tabs.map((tab) => {
          const current = pathname === tab.href;
          return (
            <li key={tab.href} className={current ? "relative z-10 -mb-px" : ""}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={`flex items-center rounded-t-xl border border-b-0 border-line px-4 font-semibold no-underline adult:rounded-t-md md:px-5 ${
                  current
                    ? `${tab.band} min-h-12 pb-px text-ink shadow-[0_-2px_6px_rgb(0_0_0/0.06)]`
                    : "min-h-11 bg-surface-muted text-ink-muted hover:bg-surface hover:text-ink adult:underline"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
