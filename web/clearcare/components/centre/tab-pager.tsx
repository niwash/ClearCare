"use client";

// components/centre/tab-pager.tsx
// At the foot of each page of a home's record, the next page and the previous one (CCARE-258): in
// user testing (P2_1) the participant kept scrolling down and forgetting the tabs at the top were
// there, so the next page and the one before are offered where a reader stops, both as the site's main
// button. On the band of the page it ends, so it reads as that page's end. Opening one goes to
// the top of the new page, where its tab is. Not on paper.
//
// On the Overview it sits under What the home offers instead, inside that band (inline), where the
// facts end, rather than after the pointer to What to ask; the layout leaves it out there (skipFirst).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { actionLinkClass } from "@/components/ui/classes";
import type { CentreTab } from "./centre-tabs";

type TabPagerProps = {
  tabs: CentreTab[];
  // Inside a band of the page's own, with no band of its own.
  inline?: boolean;
  // Not on the first page, the Overview, which places its own (inline).
  skipFirst?: boolean;
};

export function TabPager({ tabs, inline = false, skipFirst = false }: TabPagerProps) {
  const pathname = usePathname();
  const index = tabs.findIndex((tab) => tab.href === pathname);
  if (index === -1 || (skipFirst && index === 0)) return null;
  const previous = tabs[index - 1];
  const next = tabs[index + 1];

  return (
    <nav
      aria-label="More about this home"
      className={inline ? "print:hidden" : `${tabs[index].band} w-screen self-center py-6 md:py-8 print:hidden`}
    >
      <div className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-3 ${inline ? "" : "page-column px-4 md:px-8"}`}>
        {previous ? (
          <Link href={previous.href} className={`group ${actionLinkClass}`}>
            {/* Inside a span of its own, so the button's arrow nudge (to the right, for "→") leaves it
                alone; it moves left instead, the way it points. */}
            <span>
              <span
                aria-hidden
                className="inline-block transition-transform group-hover:-translate-x-1 motion-reduce:transition-none adult:group-hover:translate-x-0"
              >
                ←
              </span>
            </span>
            <span>
              <span className="sr-only">Previous: </span>
              {previous.label}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={next.href} className={actionLinkClass}>
            Next: {next.label} <span aria-hidden>→</span>
          </Link>
        ) : (
          // The last page leads back to the first, so the reader isn't left at a dead end.
          <Link href={tabs[0].href} className={actionLinkClass}>
            Back to {tabs[0].label} <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
