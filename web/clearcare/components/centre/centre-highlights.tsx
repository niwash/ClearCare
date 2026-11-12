// components/centre/centre-highlights.tsx
// What to look at first (CCARE-207, CCARE-212): the regulations a family should read about before
// anything else, each as an open block rather than a row of a table, so it reads as something
// found at the home rather than a record. Each has the judgement as a chip and why it's here in
// plain words, the inspector's or provider's own words as a quote, and a line saying what happened
// next with how it ended, which links to the full story on What happened next.
import {
  formatDate,
  formatMonth,
  highlightAnchor,
  trailAnchor,
  type Highlight,
  type Inspection,
  type PromiseTrail,
} from "@/lib/centres";
import Link from "next/link";
import { RecordPrintButton } from "@/components/centre/record-print";
import { inspectionDate, JudgementChip, OutcomePill, Quotes, SourceLink, trailOutcome } from "./finding-bits";
import { sectionHeadingClass, sectionScrollMargin } from "./section-icon";

const COUNT_WORDS = ["", "one", "two", "three", "four", "five", "six"];

// Why the regulation is here, in plain words.
function reason({ rule, dates }: Highlight) {
  switch (rule) {
    case "not-compliant-latest":
      return `At the latest inspection, ${formatDate(dates[0])}`;
    case "repeated":
      // With the span they cover, oldest to latest, so "in a row" has dates to go by.
      return `Not fully compliant at ${COUNT_WORDS[dates.length] ?? dates.length} inspections in a row · ${formatMonth(dates[0])} – ${formatMonth(dates.at(-1)!)}`;
    case "promise-not-rejudged":
      return `Promised in ${formatMonth(dates[0])}, not checked since`;
  }
}

type CentreHighlightsProps = {
  highlights: Highlight[];
  trails: PromiseTrail[];
  inspections: Inspection[];
  // The page the trails are on, What happened next (CCARE-212).
  trailsHref: string;
  // The inspection history, where every regulation is (CCARE-212).
  inspectionsHref: string;
};

export function CentreHighlights({ highlights, trails, inspections, trailsHref, inspectionsHref }: CentreHighlightsProps) {
  if (highlights.length === 0) return null;
  const count = COUNT_WORDS[highlights.length] ?? String(highlights.length);

  return (
    <section id="first" aria-labelledby="first-h" className={`${sectionScrollMargin} flex flex-col gap-6`}>
      <div className="flex flex-col gap-1.5">
        {/* Every regulation is on the inspection history, for anyone who wants more than these. */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <h2 id="first-h" className={sectionHeadingClass}>
            What to look at first
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <RecordPrintButton />
            <Link
            href={inspectionsHref}
            className="inline-flex min-h-11 items-center gap-1.5 self-center rounded-full border border-line bg-surface px-4 text-sm font-semibold whitespace-nowrap text-ink no-underline hover:border-primary hover:text-ink adult:rounded-md adult:underline print:hidden"
          >
            See all regulations <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
        <p className="max-w-3xl text-ink">
          {highlights.length === 1 ? "One thing" : `${count[0].toUpperCase()}${count.slice(1)} things`} from this
          home&apos;s reports worth reading in full, in the inspector&apos;s or the home&apos;s own words.
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {highlights.map((highlight) => {
          const trail = trails.find((candidate) => candidate.regulation.number === highlight.regulation.number);
          const quoted = highlight.sources.length > 0;
          const text = quoted && !highlight.text.startsWith("“") ? `“${highlight.text}”` : highlight.text;

          return (
            // The id is what the regulation's trail links back up to.
            <li
              key={`${highlight.rule}-${highlight.regulation.number}`}
              id={highlightAnchor(highlight.regulation)}
              className={`${sectionScrollMargin} flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-sm break-inside-avoid md:p-7 adult:rounded-lg adult:border adult:border-line adult:shadow-none`}
            >
              {/* What it is first, as the block's heading, then how it was judged and when, both in
                  full ink so neither is missed. */}
              <div className="flex flex-col gap-2.5">
                <h3 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  <span className="font-heading text-xl font-semibold text-ink md:text-2xl">{highlight.regulation.title}</span>
                  <span className="text-sm font-medium text-ink-muted">Regulation {highlight.regulation.number}</span>
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <JudgementChip judgement={highlight.judgement} />
                  <span className="font-semibold text-ink">{reason(highlight)}</span>
                </div>
              </div>

              <figure className="flex flex-col gap-2 border-l-2 border-line pl-4 md:pl-5">
                <blockquote className={quoted ? "max-w-3xl text-lg leading-relaxed text-ink" : "text-ink-muted"}>
                  {text}
                </blockquote>
                {/* The whole passage, when the quote is only its opening: closed until asked for, so
                    the page stays easy to scan. */}
                {highlight.passage && /…”?$/.test(highlight.text) ? (
                  <details className="group/passage">
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-primary print:hidden hover:text-primary-hover [&::-webkit-details-marker]:hidden">
                      <span className="group-open/passage:hidden">Read the full passage</span>
                      <span className="hidden group-open/passage:inline">Hide the full passage</span>
                      <svg aria-hidden viewBox="0 0 24 24" className="size-4 transition-transform group-open/passage:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </summary>
                    {/* On its own tinted, rounded panel, so the whole passage reads as set apart from
                        the quote above rather than as more of it. */}
                    <div className="mt-2 max-w-3xl rounded-xl bg-surface-muted px-4 py-3.5 adult:rounded-md adult:border adult:border-line">
                      <Quotes quotes={highlight.passage} bare />
                    </div>
                  </details>
                ) : null}
                <figcaption>
                  {highlight.sources.map((source) => (
                    <SourceLink key={source} source={source} href={highlight.reportUrl} />
                  ))}
                  {!quoted && highlight.reportUrl && (
                    <a href={highlight.reportUrl} className="text-small">
                      Open the report
                    </a>
                  )}
                </figcaption>
              </figure>

              {trail && <NextLine trail={trail} inspections={inspections} href={`${trailsHref}#${trailAnchor(highlight.regulation)}`} />}
              {/* On paper, room for notes, for talking it through with the home. */}
              <div aria-hidden className="hidden pt-2 text-sm print:block">
                Notes
                <div className="mt-8 border-b border-dotted border-black" />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// What happened next, in a line: what the home promised, or else how it was next judged,
// with how it ended and a link to the whole story.
function NextLine({ trail, inspections, href }: { trail: PromiseTrail; inspections: Inspection[]; href: string }) {
  const promise = trail.promises[0];
  const { followUp } = trail;
  const followUpDate = followUp && inspectionDate(inspections, followUp.inspectionId, followUp.date);

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between adult:rounded-md">
      <p className="line-clamp-2 min-w-0 text-sm leading-relaxed">
        {promise ? (
          <>
            <span className="font-semibold">The home promised{promise.due ? ` by ${promise.due}` : ""}:</span>{" "}
            <span className="text-ink-muted">“{promise.quote}”</span>
          </>
        ) : followUp && followUp.judgement !== "not-assessed" ? (
          <>
            {/* Not "the next inspection": it's the next one that judged this regulation, which can
                be a few inspections later. How it was judged is on the pill beside it. */}
            <span className="font-semibold">Judged again{followUpDate ? ` on ${followUpDate}` : ""}</span>
          </>
        ) : !followUp && !trail.orderUnknown ? (
          <span className="text-ink-muted">Found at the latest inspection, so it hasn&apos;t been checked again yet.</span>
        ) : (
          <span className="text-ink-muted">See how this was followed up.</span>
        )}
      </p>
      <div className="flex shrink-0 items-center gap-3">
        <OutcomePill outcome={trailOutcome(trail)} />
        <a href={href} className="text-sm font-semibold whitespace-nowrap tap-target print:hidden">
          Full story <span aria-hidden>→</span>
        </a>
      </div>
    </div>
  );
}
