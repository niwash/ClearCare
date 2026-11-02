// components/home/news-banner.tsx
// A news item on the home page, as a band of brand colour like nhi.ie's: why choosing care well
// matters more each year. brand-band (globals.css) turns everything inside light-on-dark.
// Figures from the ESRI's announcement of 30 June 2025, linked below.
import { actionLinkClass, fullWidthClass } from "@/components/ui/classes";
import { ExternalIcon } from "@/components/ui/external-icon";

const ESRI_URL =
  "https://www.esri.ie/news/new-esri-report-projects-that-long-term-residential-care-and-home-support-requirements-will";

export function NewsBanner() {
  return (
    // -mt-6 and md:-mt-8 cancel the page's gap between sections, so it meets the figures' band above.
    <section aria-labelledby="news-h" className={`${fullWidthClass} brand-band -mt-6 md:-mt-8`}>
      <div className="reveal mx-auto grid max-w-6xl items-center gap-8 px-4 py-8 md:grid-cols-[2fr_1fr] md:px-8 md:py-10">
        <div className="flex flex-col items-start gap-4">
          <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted adult:normal-case adult:tracking-normal">
            In the news · ESRI, 30 June 2025
          </p>
          <h2 id="news-h" className="font-heading text-2xl font-semibold text-ink md:text-3xl">
            Long-term care needs in Ireland will grow by at least 60% by 2040
          </h2>
          <p className="max-w-2xl text-ink-muted md:text-lg">
            By 2040, 1 in 5 people in Ireland will be aged 65 or over, and the number aged 85 or over is projected to
            more than double. The ESRI projects that long-term residential care and home support will need to grow
            to match.
          </p>
          <a
            href={ESRI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${actionLinkClass} mt-1`}
          >
            Read more<span className="sr-only"> on the ESRI website (opens in a new tab)</span>
            <ExternalIcon />
          </a>
        </div>

        {/* The headline figure, large, in place of nhi.ie's photo. Hidden from screen readers,
            which already hear it in the heading, and on phones, where it would only repeat it
            under the button. */}
        <div aria-hidden className="hidden flex-col items-end gap-1 text-right md:flex">
          <span className="font-heading text-6xl font-semibold leading-none text-ink md:text-8xl">60%+</span>
          <span className="max-w-56 text-ink-muted">more care beds and home support hours needed by 2040</span>
        </div>
      </div>
    </section>
  );
}
