// components/home/news-banner.tsx
// A news item on the home page, as a band of brand colour like nhi.ie's: why choosing care well
// matters more each year. brand-band (globals.css) turns everything inside light-on-dark.
// Figures from the ESRI's announcement of 30 June 2025, linked below.
const ESRI_URL =
  "https://www.esri.ie/news/new-esri-report-projects-that-long-term-residential-care-and-home-support-requirements-will";

export function NewsBanner() {
  return (
    // -mt-8 and md:-mt-12 cancel the page's gap between sections, so it meets the welcome band.
    <section aria-labelledby="news-h" className="brand-band mx-[calc(50%-50vw)] -mt-8 w-screen md:-mt-12">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-[2fr_1fr] md:px-8 md:py-14">
        <div className="flex flex-col items-start gap-4">
          <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted adult:normal-case adult:tracking-normal">
            In the news · ESRI, 30 June 2025
          </p>
          <h2 id="news-h" className="font-heading text-2xl font-semibold text-ink md:text-4xl">
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
            className="mt-1 inline-flex h-12 items-center gap-2 rounded-md bg-primary px-5 font-semibold text-on-primary no-underline hover:bg-primary-hover hover:text-on-primary"
          >
            Read more<span className="sr-only"> on the ESRI website (opens in a new tab)</span>
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
            </svg>
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
