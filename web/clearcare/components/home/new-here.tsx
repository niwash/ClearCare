// components/home/new-here.tsx
// Where a newcomer starts: the guide to the site and the tour that follows it (CCARE-164,
// CCARE-179). A rounded panel in the sage tint, in the page's column under the help cards. The
// tour's last step points at the two links by their data-tour name, guide-links.
import Link from "next/link";
import { WelcomeTour } from "@/components/home/welcome-tour";
import { secondaryLinkClass } from "@/components/ui/classes";
import { IconCircle } from "@/components/ui/icon-circle";
import { ICON_PATHS } from "@/components/ui/icons";

export function NewHere() {
  return (
    // The adult-centred design turns the tints to its band colour, so it takes a different one there,
    // with a 3:1 edge.
    <section
      aria-labelledby="new-here-h"
      className="reveal rounded-2xl bg-tint-sage px-5 py-6 md:px-8 md:py-8 adult:rounded-lg adult:border adult:border-line adult:bg-surface-muted"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
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
          <Link href="/guides/using-clearcare" className={secondaryLinkClass}>
            See how to use it <span aria-hidden>→</span>
          </Link>
          <WelcomeTour />
        </div>
      </div>
    </section>
  );
}
