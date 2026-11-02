import Link from "next/link";
import { Suspense } from "react";
import { FeatureCarousel } from "@/components/home/feature-carousel";
import { HomeHero } from "@/components/home/home-hero";
import { NewHere } from "@/components/home/new-here";
import { NewsBanner } from "@/components/home/news-banner";
import { NotAlone } from "@/components/home/not-alone";
import { SampleCentre, SampleCentreFallback } from "@/components/home/sample-centre";
import { SiteFeatures } from "@/components/home/site-features";
import { SiteFigures } from "@/components/home/site-figures";
import { actionLinkClass, fullWidthClass, secondaryLinkClass } from "@/components/ui/classes";
import { IconCircle, type Tint } from "@/components/ui/icon-circle";
import { ICON_PATHS, Icon, type IconName } from "@/components/ui/icons";
import { searchCentres } from "@/lib/search";
import { getReAssessmentStatistics } from "@/lib/statistics";

export default async function StartPage() {
  // No filters and one result per page: only total and the register's date are needed. The
  // statistics give the figures about reports; the two are read at the same time.
  const [count, statistics] = await Promise.all([searchCentres({ page_size: "1" }), getReAssessmentStatistics()]);
  const total = count.ok ? count.data.total : null;

  // The carousel first, then ordered by what a family needs (CCARE-179): who the site is for, with
  // the search, then what it can help with, where a newcomer starts, reassurance, what it holds and
  // why it matters, what ClearCare is, an example record, and a last invitation to start.
  return (
    <>
      <FeatureCarousel />

      <HomeHero />

      <SiteFeatures />

      <NewHere />

      <NotAlone />

      <SiteFigures
        homes={total}
        snapshot={count.ok ? count.data.register_snapshot : null}
        statistics={statistics.status === "found" ? statistics.statistics : null}
      />

      <NewsBanner />

      {/* What ClearCare is and why it exists, after the news of why the choice matters more each year.
          A band of its own, the full width of the window, meeting the news band above (-mt cancels
          the page's gap). The adult-centred design turns the tints to its band colour. */}
      <section
        aria-labelledby="about-h"
        className={`${fullWidthClass} -mt-6 bg-tint-blue px-4 py-10 md:-mt-8 md:px-8 md:py-14`}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <div className="flex max-w-3xl flex-col gap-2">
            <h2 id="about-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              About ClearCare
            </h2>
            <p className="text-ink-muted md:text-lg">
              ClearCare is free and independent. It doesn&apos;t rate or recommend homes: it helps you read what HIQA
              has found and understand your options.
            </p>
          </div>
          {/* Side by side from tablet width, stacked on phones. */}
          <div className="reveal grid gap-4 md:grid-cols-2 md:gap-6">
            <StatementCard label="Our Mission" icon="mission" tint="sage">
              To help people make informed decisions, and give informed consent, about nursing home care.
            </StatementCard>
            <StatementCard label="Our Vision" icon="vision" tint="gold">
              As Ireland&apos;s older population grows, more families will face this choice. We want every one of them
              to make it informed and prepared.
            </StatementCard>
          </div>
        </div>
      </section>

      {/* What a record looks like, under a heading that says so (CCARE-179). A new home on every
          load. The page above arrives first; the example streams in. */}
      <section aria-labelledby="example-h" className="flex flex-col gap-5">
        <div className="flex flex-col items-start gap-2">
          <h2 id="example-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Here&apos;s an example of how we sum up reports
          </h2>
          <span aria-hidden className="h-1 w-12 rounded-full bg-accent adult:hidden" />
          <p className="text-ink-muted md:text-lg">A home picked at random, and what its latest inspection found.</p>
        </div>
        <Suspense fallback={<SampleCentreFallback />}>
          <SampleCentre total={total} />
        </Suspense>
      </section>

      <StartBand />
    </>
  );
}

// The page's last word: an invitation to start, now that the reader knows what ClearCare is,
// meeting the footer (the negative bottom margin cancels the page's padding). The search itself is
// in the hero at the top; this sends the reader to the full search, or to the first guide.
function StartBand() {
  return (
    <section
      aria-labelledby="start-h"
      className={`${fullWidthClass} welcome-band -mb-6 px-4 py-12 md:-mb-10 md:px-8 md:py-16`}
    >
      <div className="reveal mx-auto flex max-w-3xl flex-col items-center gap-4 text-center adult:items-start adult:text-left">
        <h2 id="start-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Check a nursing home&apos;s record
        </h2>
        <p className="text-ink-muted md:text-lg">Every HIQA inspection report, one page per home.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3 adult:justify-start">
          <Link href="/search" className={actionLinkClass}>
            <Icon name="search" />
            Search for a home <span aria-hidden>→</span>
          </Link>
          <Link href="/guides/how-a-family-chooses" className={secondaryLinkClass}>
            See the steps
          </Link>
        </div>
      </div>
    </section>
  );
}

// One of the mission and vision cards in About ClearCare: an icon, the title as the card's heading
// and the statement as plain body text under it.
function StatementCard({
  label,
  icon,
  tint,
  children,
}: {
  label: string;
  icon: IconName;
  tint: Tint;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6 shadow-sm md:p-8 adult:rounded-lg adult:shadow-none">
      <IconCircle path={ICON_PATHS[icon]} size="large" tint={tint} />
      <h3 className="font-heading text-xl font-semibold md:text-2xl">{label}</h3>
      <p className="text-ink-muted md:text-lg">{children}</p>
    </div>
  );
}
