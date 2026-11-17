// components/home/survey-banner.tsx
// Asks visitors to take the user survey (/survey) during the user evaluation. A card rather than a
// full-width band, as the home page's last section, the start band, is one already. In a soft blue
// (--invite) rather than the warm band, so it reads as an invitation (CCARE-191).
import Link from "next/link";
import { actionLinkClass } from "@/components/ui/classes";

export function SurveyBanner() {
  return (
    <section
      aria-labelledby="survey-banner-h"
      className="reveal flex flex-col items-start gap-4 rounded-2xl border border-line bg-invite p-6 shadow-sm md:flex-row md:items-center md:justify-between md:gap-8 md:p-8 adult:rounded-lg adult:shadow-none"
    >
      <div className="flex max-w-2xl flex-col gap-2">
        <h2 id="survey-banner-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Help us improve ClearCare
        </h2>
        <p className="text-ink-muted md:text-lg">
          Tell us what worked and what didn&apos;t, so we can make this website better at helping families choose a
          nursing home. The survey takes about 5–10 minutes and is anonymous.
        </p>
      </div>
      <Link href="/survey" className={`${actionLinkClass} shrink-0`}>
        Take the survey <span aria-hidden>→</span>
      </Link>
    </section>
  );
}
