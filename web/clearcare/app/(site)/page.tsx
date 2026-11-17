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
import { SlideUp } from "@/components/ui/slide-up";
import { SurveyBanner } from "@/components/home/survey-banner";
import { actionLinkClass, fullWidthClass, liftCardClass } from "@/components/ui/classes";
import { ExternalIcon } from "@/components/ui/external-icon";
import { IconCircle, type Tint } from "@/components/ui/icon-circle";
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
      {/* The sections slide up as they come into view (CCARE-186). */}
      <SlideUp />

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
        className={`${fullWidthClass} -mt-6 bg-tint-blue py-10 md:-mt-8 md:py-14`}
      >
        {/* From desktop width the heading sits beside the two statements, a third of the band to their
            two thirds, rather than over them with the rest of its row empty. */}
        <div className="page-column grid items-center gap-6 px-4 md:px-8 lg:grid-cols-[1fr_2fr] lg:gap-10">
          <div className="reveal flex max-w-3xl flex-col items-start gap-3">
            <h2 id="about-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              About ClearCare
            </h2>
            <span aria-hidden className="reveal-bar h-1 w-12 origin-left rounded-full bg-accent adult:hidden" />
            <p className="text-ink-muted md:text-lg">
              ClearCare is free and independent. It doesn&apos;t rate or recommend homes: it helps you read what HIQA
              has found and understand your options.
            </p>
          </div>
          {/* Side by side from tablet width, stacked on phones. */}
          <div className="reveal-stagger grid gap-4 md:grid-cols-2 md:gap-6">
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
        <div className="reveal flex flex-col items-start gap-2">
          {/* The record card above (site-features.tsx) jumps here; the margin keeps the heading clear of
              the window's top edge. */}
          <h2 id="example-h" className="scroll-mt-6 font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Here&apos;s an example of how we sum up reports
          </h2>
          <span aria-hidden className="reveal-bar h-1 w-12 origin-left rounded-full bg-accent adult:hidden" />
          <p className="text-ink-muted md:text-lg">A home picked at random, and what its latest inspection found.</p>
        </div>
        <Suspense fallback={<SampleCentreFallback />}>
          <SampleCentre total={total} updated={count.ok ? count.data.register_snapshot.fetched_at : null} />
        </Suspense>
      </section>

      {/* For the user evaluation (CCARE-147): after the example, before the last invitation. */}
      <SurveyBanner />

      <StartBand />
    </>
  );
}

// The page's last word, meeting the footer (the negative bottom margin cancels the page's padding):
// where ClearCare's reports come from, in a sentence, then where to read more. It said "Check a
// nursing home's record" before; in user testing (P2_1, CCARE-258) the participant didn't know what
// HIQA was, and the word record threw them. The search is in the hero at the top. Left-aligned in
// the page's column, level with the sections above, rather than centred.
// TODO: point "What is HIQA?" at ClearCare's own page on HIQA and its data once it exists; until then
// it goes to HIQA's own About us page.
function StartBand() {
  return (
    <section
      aria-labelledby="start-h"
      className={`${fullWidthClass} welcome-band relative isolate -mb-6 overflow-hidden py-12 md:-mb-10 md:py-16`}
    >
      {/* A report under a magnifying glass, large and faint behind the band's left side and cut off
          by its edges, as a background rather than a picture beside the words (CCARE-258). Faint
          enough that the words over it stay easy to read. Decoration only; not in the adult-centred
          design, which keeps decoration to a minimum. */}
      <svg
        aria-hidden
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        // Upright, taller than the band and anchored near its foot, so the top of the page is cut
        // off but the lines and the magnifying glass, which say what it is, stay in view.
        className="pointer-events-none absolute -bottom-6 -left-10 -z-10 size-96 text-primary opacity-[0.08] md:left-0 md:size-[30rem] adult:hidden"
      >
        <path d="M14 6h24l12 12v34a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z" />
        <path d="M38 6v12h12" />
        <path d="M18 26h16M18 33h12M18 40h8" />
        <circle cx="42" cy="44" r="9" />
        <path d="M48.5 50.5 58 60" strokeWidth={3} />
      </svg>
      {/* The words on the left and the buttons on the right from desktop width, as in the survey
          card above; stacked on smaller screens. */}
      <div className="reveal page-column flex flex-col gap-6 px-4 md:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="flex max-w-3xl flex-col gap-3">
          <h2 id="start-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Inspection reports from HIQA
          </h2>
          <p className="text-ink-muted md:text-lg">
            HIQA, the Health Information and Quality Authority, inspects every nursing home for older people in Ireland
            and publishes a report of each inspection. ClearCare uses those reports and sums them up, so they&apos;re
            easier to read.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:shrink-0 lg:justify-end">
          <a href="https://www.hiqa.ie/about-us" className={actionLinkClass}>
            What is HIQA?
            <ExternalIcon />
          </a>
          {/* To the notice's section on HIQA's reports, which says how ClearCare uses them. */}
          <Link href="/privacy#reports-h" className={actionLinkClass}>
            Read our privacy notice <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

// One of the mission and vision cards in About ClearCare: an icon beside the title, the card's
// heading, and the statement as plain body text under them. Hovering the card plays its icon's
// animation (statement-icon, globals.css, CCARE-258): the target's rings drawn in, or the light
// bulb hopping and shining.
function StatementCard({
  label,
  icon,
  tint,
  children,
}: {
  label: string;
  icon: "mission" | "vision";
  tint: Tint;
  children: React.ReactNode;
}) {
  return (
    // The outer box is what slides in with its row (reveal-stagger), which sets its own transition;
    // the card inside it lifts a little on hover, like a card picked up, as the site's buttons do,
    // so the two motions don't share one transition. No lift with reduced motion or in the
    // adult-centred design.
    <div className="h-full">
      <div
        className={`group flex h-full flex-col gap-3 rounded-2xl border border-line bg-surface p-6 shadow-sm adult:rounded-lg adult:shadow-none ${liftCardClass}`}
      >
        {/* The icon beside the title, so the card is no taller than its words need. */}
        <h3 className="flex items-center gap-3 font-heading text-xl font-semibold md:text-2xl">
          <IconCircle size="large" tint={tint} className="reveal-pop">
            {icon === "mission" ? <MissionIcon /> : <VisionIcon />}
          </IconCircle>
          {label}
        </h3>
        <p className="text-ink-muted md:text-lg">{children}</p>
      </div>
    </div>
  );
}

// A target, as ICON_PATHS.mission, as three parts: the two rings, which draw themselves in from the
// outside when the card is hovered (pathLength 1, so one dash is a whole ring), and the dot, which
// pops in after them.
function MissionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="statement-icon size-6"
    >
      <circle cx="12" cy="12" r="9" pathLength={1} className="mission-ring" transform="rotate(-90 12 12)" />
      <circle
        cx="12"
        cy="12"
        r="5"
        pathLength={1}
        className="mission-ring [--ring-delay:0.25s]"
        transform="rotate(-90 12 12)"
      />
      <circle cx="12" cy="12" r="1" className="mission-dot" />
    </svg>
  );
}

// A light bulb, as ICON_PATHS.vision, in outline: when the card is hovered the bulb jumps up, and
// five rays burst outwards around it on the way, fully out as it lands. The rays sit
// well clear of the glass (from 8.5 to 11.5 units from its centre), so they run past the 24-unit
// grid into the circle around it; the svg lets them show there (overflow visible).
const GLASS = "M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z";

function VisionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      overflow="visible"
      className="statement-icon size-6"
    >
      {/* The rays inside the bulb's group, so they jump with it rather than the glass rising
          through them. */}
      <g className="vision-bulb">
        <g className="vision-rays" strokeWidth={2.2}>
          <path d="M12 .5v-3M18 3l2.1-2.1M6 3 3.9.9M20.5 9h3M3.5 9h-3" />
        </g>
        <path d={`M9 18h6M10 21h4${GLASS}`} />
      </g>
    </svg>
  );
}
