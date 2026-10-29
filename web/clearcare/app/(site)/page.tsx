import Link from "next/link";
import { Suspense } from "react";
import { FeatureCarousel } from "@/components/home/feature-carousel";
import { NewsBanner } from "@/components/home/news-banner";
import { SampleCentre, SampleCentreFallback } from "@/components/home/sample-centre";
import { SiteFeatures } from "@/components/home/site-features";
import { SiteFigures } from "@/components/home/site-figures";
import { WelcomeTour } from "@/components/home/welcome-tour";
import { fullWidthClass, primaryButtonClass, textInputClass } from "@/components/ui/classes";
import { IconCircle } from "@/components/ui/icon-circle";
import { ICON_PATHS, Icon, type IconName } from "@/components/ui/icons";
import { MAX_TEXT_LENGTH, searchCentres } from "@/lib/search";
import { getReAssessmentStatistics } from "@/lib/statistics";

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ logout?: string }>;
}) {
  const { logout } = await searchParams;
  // No filters and one result per page: only total and the register's date are needed. The
  // statistics give the figures about reports; the two are read at the same time.
  const [count, statistics] = await Promise.all([searchCentres({ page_size: "1" }), getReAssessmentStatistics()]);
  const total = count.ok ? count.data.total : null;

  return (
    <>
      {/* First, before the carousel: a visitor who just signed out has to be able to read this,
          and it must not sit under anything fixed to the bottom of the screen. */}
      {logout === "unavailable" && (
        <p
          role="status"
          className="mx-auto mt-6 mb-2 w-full max-w-6xl rounded-md border border-line bg-surface-muted p-4 text-ink md:px-8"
        >
          You are signed out of ClearCare. The identity provider could not be reached to end its
          own session, so this browser may still remember you there.
        </p>
      )}

      <FeatureCarousel />

      {/* The page's h1: who the site is for, what it does and what it is for, before any task. A
          tinted band the full width of the window, set apart from the rest of the page, with the
          words centred. The adult-centred design keeps them left-aligned, which is easier to read
          (NIA/NLM: left-justify text). */}
      {/* md:-mt-8 cancels the page's gap between sections, so on wider screens the band starts
          where the carousel ends. */}
      <section className={`${fullWidthClass} bg-band px-4 py-8 md:-mt-8 md:px-8 md:py-12 adult:md:mt-0`}>
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 text-center adult:items-start adult:text-left">
          <div className="flex max-w-3xl flex-col items-center gap-4 adult:items-start">
            <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">Welcome to ClearCare</h1>
            <p className="md:text-lg">
              Choosing a nursing home is a big decision, for the person moving in and for their family. We bring
              together the information you need to choose a nursing home and explain it in a way that is easy to
              understand.
            </p>
            {/* The guide to the site itself, where a newcomer starts reading, and the tour that
                follows it (CCARE-164). */}
            <div data-tour="guide-links" className="flex scroll-mt-6 flex-wrap justify-center gap-3 adult:justify-start">
              <Link
                href="/guides/using-clearcare"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-surface px-4 font-semibold text-ink no-underline hover:border-primary hover:text-ink"
              >
                New to ClearCare? See how to use it <span aria-hidden>→</span>
              </Link>
              {/* Not while the sign-out notice is showing: the tour panel is fixed to the bottom of
                  a phone screen, and it covered that notice when both appeared. */}
              {logout !== "unavailable" && <WelcomeTour />}
            </div>
          </div>

          {/* Side by side from tablet width, stacked on phones. */}
          <div className="grid w-full gap-4 md:grid-cols-2 md:gap-6">
            <StatementCard label="Our Mission" icon="mission">
              To help people make informed decisions, and give informed consent, about nursing home care.
            </StatementCard>
            <StatementCard label="Our Vision" icon="vision">
              As Ireland&apos;s older population grows, more families will face this choice. We want every one of
              them to make it informed and prepared.
            </StatementCard>
          </div>
        </div>
      </section>

      <SiteFeatures />

      <SiteFigures
        homes={total}
        snapshot={count.ok ? count.data.register_snapshot : null}
        statistics={statistics.status === "found" ? statistics.statistics : null}
      />

      <NewsBanner />

      <div className="grid gap-6 md:grid-cols-[3fr_1fr] md:gap-10">
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Check a nursing home&apos;s record
          </h2>

          {/* Name or Eircode here; the search page works out which. It has address and county too. */}
          {/* A visible label, not a faded hint in the box: people read one as already filled in
              (CCARE-164). */}
          <form action="/search" method="GET" role="search" aria-label="Find a nursing home" className="flex flex-col gap-1">
            <label htmlFor="start-search" className="text-sm font-medium">
              Nursing home name or Eircode
            </label>
            <div className="flex gap-2">
              <input
                id="start-search"
                name="q"
                type="search"
                maxLength={MAX_TEXT_LENGTH}
                className={`${textInputClass} flex-1`}
              />
              <button type="submit" className={primaryButtonClass}>
                Search
              </button>
            </div>
          </form>

          <p className="text-sm">
            <Link href="/search" className="tap-target">Search by address or county instead →</Link>
          </p>
        </div>
        {/* self-start: as tall as its words, not stretched to the height of the search column. */}
        <aside className="self-start rounded-lg border border-line bg-surface p-3 text-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <Icon name="info" className="size-5 text-primary" />
            What this site doesn&apos;t do
          </h2>
          <p className="mt-1 text-ink-muted">
            It doesn&apos;t rate or recommend homes, or show free beds. For beds, ask the home or a hospital social
            worker.
          </p>
        </aside>
      </div>

      {/* A new home on every load. The page above arrives first; the example streams in. */}
      <Suspense fallback={<SampleCentreFallback />}>
        <SampleCentre total={total} />
      </Suspense>
    </>
  );
}

// One of the mission and vision cards in the welcome band: the title as the card's heading, in the
// accent colour, then the statement as plain body text under it. White cards on the tinted band.
function StatementCard({ label, icon, children }: { label: string; icon: IconName; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface p-6 md:p-8 adult:items-start">
      <IconCircle path={ICON_PATHS[icon]} size="large" />
      <h2 className="font-heading text-2xl font-semibold text-primary md:text-3xl">{label}</h2>
      <p className="text-ink-muted md:text-lg">{children}</p>
    </div>
  );
}
