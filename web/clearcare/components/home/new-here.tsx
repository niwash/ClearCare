// components/home/new-here.tsx
// Where a newcomer starts: the guide to the site and the tour that follows it (CCARE-164,
// CCARE-179). A band of its own, the full width of the window, in a tint unlike the help cards'
// band above it, which it meets. The tour's last step points at the two links by their data-tour
// name, guide-links.
import Link from "next/link";
import { WelcomeTour } from "@/components/home/welcome-tour";
import { fullWidthClass } from "@/components/ui/classes";
import { IconCircle } from "@/components/ui/icon-circle";
import { ICON_PATHS } from "@/components/ui/icons";

export function NewHere() {
  return (
    // -mt-6 and md:-mt-8 cancel the page's gap between sections, so it meets the band above. The
    // adult-centred design turns the tints to its band colour, so it takes a different one there.
    <section
      aria-labelledby="new-here-h"
      className={`${fullWidthClass} -mt-6 bg-tint-sage px-4 py-8 md:-mt-8 md:px-8 md:py-10 adult:bg-surface-muted`}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="flex items-start gap-4">
          <IconCircle path={ICON_PATHS.info} size="large" tint="blue" />
          <div className="flex flex-col gap-1">
            <h2 id="new-here-h" className="font-heading text-xl font-semibold md:text-2xl">
              New to ClearCare?
            </h2>
            <p className="text-ink-muted">
              Find your way around in a few minutes: read how the site works, or let us show you.
            </p>
          </div>
        </div>
        <div data-tour="guide-links" className="flex shrink-0 scroll-mt-6 flex-wrap gap-3">
          <Link
            href="/guides/using-clearcare"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-surface px-4 font-semibold text-ink no-underline hover:border-primary hover:text-ink"
          >
            See how to use it <span aria-hidden>→</span>
          </Link>
          <WelcomeTour />
        </div>
      </div>
    </section>
  );
}
