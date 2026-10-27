// app/national/page.tsx
// What each judgment became at the home's next inspection report, across every report ClearCare
// has loaded. The figures come from GET /statistics/re-assessment; the page only draws them.
import { JudgementIcon } from "@/components/centre/judgement-icon";
import { GuidesBand } from "@/components/guides/guide-ending";
import { ContentsNav, SectionEnd, sectionScrollMargin, StepNumber } from "@/components/guides/step-number";
import { Alert } from "@/components/layout/alert";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ContactsBanner } from "@/components/layout/contacts-banner";
import { BarList } from "@/components/national/bar-list";
import { NextResultMatrix } from "@/components/national/next-result-matrix";
import { actionLinkClass, fullWidthClass } from "@/components/ui/classes";
import { Icon } from "@/components/ui/icons";
import { formatDate, type Judgement } from "@/lib/centres";
import { getGuide } from "@/lib/guides";
import {
  formatCount,
  formatPercent,
  getReAssessmentStatistics,
  statisticsUnavailableMessage,
  STARTING_JUDGEMENTS,
  type NextResultCounts,
  type ReAssessmentStatistics,
  type StartingJudgment,
} from "@/lib/statistics";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

export const metadata = { title: "National figures" };

export default async function NationalPage() {
  // Read the figures on each request. Otherwise the build prerenders the page once, and a build
  // without API_URL would serve "unavailable" until the next build.
  await connection();
  const lookup = await getReAssessmentStatistics();

  return (
    <>
      <NationalHero />

      {/* What the figures are, in a box like the Fair Deal guide's summary, before the contents. */}
      <p className="max-w-4xl rounded-lg border border-line border-l-4 border-l-primary bg-surface px-5 py-4 md:text-lg">
        For every regulation judged in an inspection report, these figures show what the same home&apos;s next report
        found for it. The figures come from all the HIQA inspection reports ClearCare has loaded.
      </p>

      {lookup.status === "found" ? (
        <NationalFigures statistics={lookup.statistics} />
      ) : (
        // The same message the centre page shows when its record can't be read.
        <Alert title="These figures aren't available right now">{statisticsUnavailableMessage(lookup.httpStatus)}</Alert>
      )}

      <SearchPrompt />

      {/* So nobody leaves unsure what the judgments mean or how to use them. */}
      <GuidesBand
        id="national-guides-h"
        title="Making sense of these figures"
        intro="Inspection reports use a lot of HIQA’s own language. Our guides explain it, and what to ask a home."
        guides={NATIONAL_GUIDES}
      />

      {/* The negative bottom margin cancels the page's padding, so it meets the footer. */}
      <ContactsBanner className="-mb-6 md:-mb-10" />
    </>
  );
}

const NATIONAL_GUIDES = [
  getGuide("reading-inspection-reports"),
  getGuide("choosing-a-nursing-home"),
  getGuide("how-a-family-chooses"),
];

// The top of the page, flush under the header as on the search page: the breadcrumb, the heading
// and a line of welcome on a band of brand colour (brand-band, globals.css).
function NationalHero() {
  return (
    <section aria-labelledby="national-h" className={`${fullWidthClass} brand-band -mt-6 md:-mt-10`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
        <div className="flex flex-col items-start gap-3">
          <Breadcrumb trail={[]} current="National Figures" />
          <h1 id="national-h" className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            What happens at the next inspection?
          </h1>
        </div>

        <p className="text-sm text-ink-muted">
          New to inspection reports?{" "}
          <Link href="/guides/reading-inspection-reports" className="text-ink tap-target">
            Learn how to read a HIQA inspection report →
          </Link>
        </p>
      </div>
    </section>
  );
}

// The numbered sections, in page order, for the contents and each section's heading.
const SECTIONS = [
  { id: "results-change", title: "How results changed at the next inspection" },
  { id: "next-result", title: "What each result became at the next inspection" },
  { id: "re-check", title: "How often regulations were checked again" },
  { id: "about", title: "Where these figures come from" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// One numbered section, as in the Fair Deal guide: its number in a circle of brand colour beside
// the heading. The id is the target of its link in the contents; scroll-mt keeps the heading clear
// of the top of the window. Sections 1 and 3 are tinted bands the full width of the window, as on
// the Fair Deal guide, so it is clear where each one starts and ends.
function NationalSection({ id, description, children }: { id: SectionId; description?: string; children: ReactNode }) {
  const index = SECTIONS.findIndex((section) => section.id === id);
  const tinted = index % 2 === 0;
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className={`${sectionScrollMargin} ${tinted ? `${fullWidthClass} bg-band py-8 md:py-10` : ""}`}
    >
      <div className={`flex flex-col gap-4 ${tinted ? "mx-auto max-w-6xl px-4 md:px-8" : ""}`}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <StepNumber number={index + 1} />
            <h2 id={`${id}-h`} className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              {SECTIONS[index].title}
            </h2>
          </div>
          {description && <p className="max-w-3xl text-ink-muted">{description}</p>}
        </div>
        {children}
        <SectionEnd />
      </div>
    </section>
  );
}

function NationalFigures({ statistics }: { statistics: ReAssessmentStatistics }) {
  const { matrix, re_check_rate } = statistics;
  // Each n is the population its chart plots.
  const judgments = matrix.reduce((sum, row) => sum + row.total, 0);
  const judgmentsWithLaterReport = re_check_rate.reduce((sum, row) => sum + row.with_later_report, 0);
  const notCompliant = matrix.find((row) => row.judgment === "Not compliant");

  return (
    <>
      {/* The sections at a glance, each a link down to it, as in the Fair Deal guide. */}
      <ContentsNav label="Contents" items={SECTIONS} />

      <KeyFindings statistics={statistics} />

      <NationalSection
        id="next-result"
        description="This graph shows what happened to each result at the home's next inspection. Start with what one inspection found, then see what the next inspection found for the same regulation. The darker the box, the more results ended up there."
      >
        <Chart>
          <NextResultMatrix matrix={matrix} />
          <p className="text-small leading-relaxed text-ink-muted">
            {notCompliant && notCompliant.total > 0 && (
              <>
                For example, of {formatCount(notCompliant.total)} results judged{" "}
                <Term judgement="not-compliant">Not compliant</Term>,{" "}
                {formatPercent(notCompliant.compliant / notCompliant.total)} were{" "}
                <Term judgement="compliant">Compliant</Term> at the next inspection.{" "}
              </>
            )}
            Based on {formatCount(judgments)} results. {/* ADR-0015: it means no more than this. */}
            <strong>Not checked again</strong> means the home&apos;s next inspection report didn&apos;t mention that
            regulation.
          </p>
        </Chart>
      </NationalSection>

      <NationalSection
        id="re-check"
        description="Inspections don't look at every regulation each time. This graph shows how often the next inspection looked at the same regulation again, for each result. It only counts homes that have had another inspection since."
      >
        <Chart>
          <BarList
            rows={re_check_rate.map((row) => ({
              label: (
                <span className="flex items-center gap-2">
                  <JudgementIcon judgement={STARTING_JUDGEMENTS[row.judgment]} />
                  {row.judgment}
                </span>
              ),
              fraction: row.rate,
              value: row.rate === null ? "No later report yet" : formatPercent(row.rate),
            }))}
          />
          <p className="text-small leading-relaxed text-ink-muted">
            Based on {formatCount(judgmentsWithLaterReport)} results from homes that have had another inspection.
          </p>
        </Chart>
      </NationalSection>

      <AboutTheseFigures statistics={statistics} />
    </>
  );
}

// The answer first, in words: three shares worked out from the figures below. The first two count
// only results the next inspection judged again, so "Not checked again" doesn't water them down;
// the third counts every result from homes that have had a later inspection.
function KeyFindings({ statistics }: { statistics: ReAssessmentStatistics }) {
  const row = (judgment: StartingJudgment) => statistics.matrix.find((r) => r.judgment === judgment);
  const notCompliant = row("Not compliant");
  const compliant = row("Compliant");
  const withLaterReport = statistics.re_check_rate.reduce((sum, r) => sum + r.with_later_report, 0);
  const reAssessed = statistics.re_check_rate.reduce((sum, r) => sum + r.re_assessed, 0);

  const checkedAgainFindings = [
    notCompliant &&
      checkedAgain(notCompliant) > 0 && {
        id: "not-compliant-after",
        share: (notCompliant.compliant + notCompliant.substantially_compliant) / checkedAgain(notCompliant),
        text: (
          <>
            of <Term judgement="not-compliant">Not compliant</Term> results were{" "}
            <Term judgement="compliant">Compliant</Term> or{" "}
            <Term judgement="substantially-compliant">Substantially compliant</Term> when the next inspection checked
            again.
          </>
        ),
      },
    compliant &&
      checkedAgain(compliant) > 0 && {
        id: "compliant-after",
        share: compliant.compliant / checkedAgain(compliant),
        text: (
          <>
            of <Term judgement="compliant">Compliant</Term> results were still{" "}
            <Term judgement="compliant">Compliant</Term> when the next inspection checked again.
          </>
        ),
      },
  ].filter((finding) => finding !== false && finding !== undefined);

  const allRulesFinding = withLaterReport > 0 && {
    id: "not-checked-again",
    share: (withLaterReport - reAssessed) / withLaterReport,
    text: (
      <>
        of results were <Term judgement="not-assessed">Not checked again</Term> at the home&apos;s next inspection.
      </>
    ),
  };

  if (checkedAgainFindings.length === 0 && !allRulesFinding) return null;

  return (
    <NationalSection id="results-change">
      {/* Grouped by what each share is out of, so cards with different bases aren't read as one set.
          The last card is out of every result from homes inspected again, so a line sets it apart. */}
      <div className="grid gap-6 md:grid-cols-3 md:gap-4">
        {checkedAgainFindings.length > 0 && (
          <div className="flex flex-col gap-2 md:col-span-2">
            <h3 className="text-sm font-semibold text-ink-muted">Out of regulations that were checked again</h3>
            <ul className="grid gap-4 sm:grid-cols-2">
              {checkedAgainFindings.map((finding) => (
                <FindingCard key={finding.id} finding={finding} className="border border-line bg-surface" />
              ))}
            </ul>
          </div>
        )}
        {allRulesFinding && (
          <div className="flex flex-col gap-2 border-t border-line pt-6 md:border-l md:border-t-0 md:pl-4 md:pt-0">
            <h3 className="text-sm font-semibold text-ink-muted">Out of results from homes inspected again</h3>
            <ul className="grid">
              <FindingCard finding={allRulesFinding} className="border border-line bg-surface" />
            </ul>
          </div>
        )}
      </div>
      <p className="max-w-3xl">Every home is different, so check the homes you&apos;re considering.</p>
    </NationalSection>
  );
}

type Finding = { share: number; text: ReactNode };

// The big number in words, then what it is a share of.
function FindingCard({ finding, className }: { finding: Finding; className: string }) {
  return (
    <li className={`flex flex-col gap-2 rounded-lg p-4 md:p-6 ${className}`}>
      <span className="font-heading text-4xl font-semibold text-primary md:text-4xl">{inWords(finding.share)}</span>
      <span>{finding.text}</span>
    </li>
  );
}

// "3 in 4" or "6 in 10": easier to picture than a percentage. Quarters, thirds and halves when the
// share is within two points of one, otherwise the nearest tenth.
const SIMPLE_FRACTIONS: [number, string][] = [
  [1 / 4, "1 in 4"],
  [1 / 3, "1 in 3"],
  [1 / 2, "1 in 2"],
  [2 / 3, "2 in 3"],
  [3 / 4, "3 in 4"],
];

function inWords(share: number) {
  if (share >= 0.95) return "Almost all";
  if (share < 0.05) return "Very few";
  const simple = SIMPLE_FRACTIONS.find(([fraction]) => Math.abs(share - fraction) <= 0.02);
  return simple ? simple[1] : `${Math.round(share * 10)} in 10`;
}

// A judgment named in a sentence, with the marker the table and the centre pages use for it.
// Kept on one line, so the marker never wraps away from its word.
function Term({ judgement, children }: { judgement: Judgement; children: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap font-semibold">
      <span className="translate-y-0.5">
        <JudgementIcon judgement={judgement} />
      </span>
      {children}
    </span>
  );
}

// Results the next report judged again: the three judgment columns. A result printed in another
// spelling is in the row's total but in no column, so it is left out here too.
function checkedAgain(row: NextResultCounts) {
  return row.compliant + row.substantially_compliant + row.not_compliant;
}

function Chart({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 md:p-6">{children}</div>;
}

// How the figures are made: what the less obvious terms mean, what is left out, and how much the
// figures rest on. The notes, then the coverage chart under them.
function AboutTheseFigures({ statistics }: { statistics: ReAssessmentStatistics }) {
  const { matrix, coverage, data_date: dataDate } = statistics;
  const unmatched = matrix.reduce(
    (sum, row) => sum + row.total - checkedAgain(row) - row.not_re_assessed - row.no_later_report,
    0,
  );

  return (
    <NationalSection id="about">
      <div className="flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-4">
          {/* The exclusions are the view's and the API's (ADR-0015, NextResultCounts in api/openapi.yaml). */}
          <p className="leading-relaxed">
            Reports without an inspection date are left out, and so is a report when the home has two reports on the
            date of its next inspection.
            {/* Only when it happens: a next result printed in a spelling HIQA doesn't use is in a row's
                total but in no column. */}
            {unmatched > 0 && (
              <>
                {" "}
                {formatCount(unmatched)} {unmatched === 1 ? "result" : "results"} had a next result written in a way
                that doesn&apos;t match HIQA&apos;s judgments, so {unmatched === 1 ? "it counts" : "they count"} in
                &ldquo;Results judged&rdquo; but in none of the columns.
              </>
            )}
          </p>
          <p>
            These figures include inspections up to {formatDate(dataDate)}.{" "}
            <a href="/national/re-assessment.csv" className="inline-flex items-center gap-1.5">
              <Icon name="download" />
              Download the figures as a spreadsheet (CSV)
            </a>
          </p>
          <p className="text-small leading-relaxed text-ink-muted">
            The information comes from HIQA inspection reports, reused under the Irish PSI licence (CC BY 4.0).
          </p>
        </div>

        <Chart>
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold">How much information we have</h3>
            <p className="text-sm text-ink-muted">We can only compare inspections for homes with at least two reports.</p>
          </div>
          {/* Every bar is on the scale of the reports loaded. Judgments are shown as a number only:
              a report holds many, so on that scale the bar would run off the chart, and on a
              scale of its own it would look like 100%. */}
          <BarList
            rows={[
              {
                label: "Inspection reports we have",
                fraction: 1,
                value: formatCount(coverage.reports_loaded),
              },
              {
                label: "Homes with two or more reports",
                fraction: coverage.centres_with_two_or_more_reports / coverage.reports_loaded,
                value: formatCount(coverage.centres_with_two_or_more_reports),
              },
              {
                label: "Reports we could compare with the next one",
                fraction: coverage.reports_paired / coverage.reports_loaded,
                value: formatCount(coverage.reports_paired),
              },
              {
                label: "Results compared",
                fraction: null,
                value: formatCount(coverage.judgments_paired),
              },
            ]}
          />
        </Chart>
      </div>
    </NationalSection>
  );
}

// From the national picture to a home: the figures can't speak for one home, its record can.
function SearchPrompt() {
  return (
    <section
      aria-labelledby="search-prompt-h"
      className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface-muted p-6 md:flex-row md:items-center md:justify-between md:p-8"
    >
      <div className="flex max-w-2xl flex-col gap-2">
        <h2 id="search-prompt-h" className="font-heading text-xl font-semibold md:text-2xl">
          Looking at a particular home?
        </h2>
        <p className="text-ink-muted">Each home&apos;s page shows its inspection reports and results over time.</p>
      </div>
      <Link href="/search" className={`${actionLinkClass} shrink-0`}>
        Search for homes <span aria-hidden>→</span>
      </Link>
    </section>
  );
}
