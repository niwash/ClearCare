// components/home/sample-centre.tsx
// The start page's example home, under the page's "Here's an example of how we sum up reports"
// heading, so its own headings are a level down. Rendered on the server inside <Suspense>, so the
// rest of the page arrives first and this streams in when the home has been picked.
//
// Laid out like a small record (CCARE-232). From desktop width the home and its latest inspection's
// counts are on the left and what wasn't fully compliant on the right, rather than one column whose
// rows were mostly empty; on narrower screens the two stack. Each finding is shown as the record
// shows it on What to look at first: the regulation's name first, then how it was judged as the
// record's own chip (finding-bits.tsx). The quotes that page has are left to it, as reading them
// here would take more requests on every visit to the home page. Each column ends in its buttons,
// so no strip under the two is left half empty: the record and another home under the counts, and
// under the findings, on a line that says they open its pages, one to each of the record's tabs, so
// the example shows what a record holds.
import Link from "next/link";
import { JudgementChip } from "@/components/centre/finding-bits";
import { JUDGEMENT_LABELS, JudgementIcon } from "@/components/centre/judgement-icon";
import { ShowAnotherHome } from "@/components/home/show-another-home";
import { actionLinkClass } from "@/components/ui/classes";
import { CENTRE_SECTION_TITLES, centrePath } from "@/lib/centre-record";
import { formatDate, type Change } from "@/lib/centres";
import { getSampleCentre } from "@/lib/sample-centre";

// Findings listed before "and N more".
const SHORT_LIST = 5;

const COUNT_ORDER = ["not-compliant", "substantially-compliant", "compliant"] as const;

// How a finding compares with the last time the regulation was judged.
const CHANGE_WORDS: Record<Change, string> = {
  worse: "Worse than last time",
  better: "Better than last time",
  same: "Same as last time",
};

// The record's tabs after the overview, in the order the record has them (centres/[id]/layout.tsx).
const TABS = ["look-first", "next-steps", "inspections", "questions"] as const;

// A small outlined button, as "See all regulations" on the record: for the tabs.
const tabLinkClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink no-underline hover:border-primary hover:text-ink adult:rounded-md adult:underline";

export async function SampleCentre({ total }: { total: number | null }) {
  const sample = await getSampleCentre(total);
  // Nothing could be read: leave the space empty rather than show a broken example.
  if (!sample) return null;

  const { centre, latest, reportCount, firstYear, counts, findings } = sample;
  const assessed = counts.compliant + counts["substantially-compliant"] + counts["not-compliant"];
  const shown = findings.slice(0, SHORT_LIST);

  return (
    <article
      aria-labelledby="sample-h"
      className="reveal overflow-hidden rounded-2xl border border-line bg-surface shadow-sm adult:rounded-lg adult:shadow-none"
    >
      <div className="grid lg:grid-cols-[2fr_3fr]">
        {/* The home and its latest inspection in figures, on a muted panel so the two halves read
            as the home and what was found there. */}
        <div className="flex flex-col gap-5 border-b border-line-soft bg-surface-muted px-4 py-5 md:px-7 md:py-7 lg:border-r lg:border-b-0">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-wider text-ink-muted adult:normal-case adult:tracking-normal">
              Randomly picked centre
            </p>
            <h3 id="sample-h" className="font-heading text-xl font-semibold md:text-2xl">
              {/* Underlined on hover only in the standard design (CCARE-214); always in Easier to read. */}
              <Link href={centrePath(centre.centre_id)} className="text-ink no-underline tap-target hover:underline adult:underline">
                {centre.centre_name}
              </Link>
            </h3>
            <p className="text-sm text-ink-muted">
              Co. {centre.county} · {reportCount} {reportCount === 1 ? "report" : "reports"} since {firstYear}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <p>
              Latest inspection (
              <a href={latest.reportUrl}>
                {latest.type.toLowerCase()}, {formatDate(latest.date)}
              </a>
              ): {assessed} {assessed === 1 ? "regulation" : "regulations"} assessed
            </p>
            {/* Each count large, over its judgement's mark and name. */}
            <ul aria-label="Judgements at the latest inspection" className="grid grid-cols-3 gap-2 md:gap-3">
              {COUNT_ORDER.map((judgement) => (
                <li
                  key={judgement}
                  className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-2.5 py-3 sm:px-3 adult:rounded-md"
                >
                  <span className="flex items-center gap-2 font-heading text-2xl font-semibold md:text-3xl">
                    <JudgementIcon judgement={judgement} size={18} />
                    {counts[judgement]}
                  </span>
                  <span className="text-sm leading-snug text-ink-muted">{JUDGEMENT_LABELS[judgement]}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* At the column's foot, level with the record's pages beside them: the record, and
              another home. */}
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            {/* The card's call to action, as a button (CCARE-214). */}
            <Link href={centrePath(centre.centre_id)} className={actionLinkClass}>
              See full record<span className="sr-only"> for {centre.centre_name}</span>
              <span aria-hidden>→</span>
            </Link>
            {/* Picks again on the server without reloading the page, so the reader keeps their place. */}
            <ShowAnotherHome currentName={centre.centre_name} />
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 py-5 md:px-7 md:py-7">
          <h4 className="font-heading text-lg font-semibold md:text-xl">What wasn&apos;t fully compliant</h4>
          {findings.length === 0 ? (
            <p className="text-ink-muted">All assessed regulations were compliant.</p>
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-line-soft">
                {shown.map(({ regulation, judgement, change }) => (
                  <li key={regulation.number} className="flex flex-col gap-1.5 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold">{regulation.title}</span>
                      <span className="text-sm text-ink-muted">Regulation {regulation.number}</span>
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                      <JudgementChip judgement={judgement} />
                      {change && <span className="text-sm text-ink-muted">{CHANGE_WORDS[change]}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {findings.length > shown.length && (
                <p className="text-sm text-ink-muted">and {findings.length - shown.length} more.</p>
              )}
              {/* The rest of what was assessed, so a short list isn't read as the whole inspection. */}
              {counts.compliant > 0 && (
                <p className="flex items-center gap-2 text-sm text-ink-muted">
                  <JudgementIcon judgement="compliant" />
                  {counts.compliant === 1
                    ? "The other regulation assessed was compliant."
                    : `The other ${counts.compliant} regulations assessed were compliant.`}
                </p>
              )}
            </>
          )}

          {/* Each of the record's tabs by its own name, at the column's foot. They open other pages,
              which a row of bare names didn't say: the line before them and each one's arrow, the
              site's mark for a link to a page, do. */}
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
            <p id="sample-tabs" className="mr-1 w-full text-sm text-ink-muted xl:w-auto">
              Or go straight to a page of this record:
            </p>
            <ul aria-labelledby="sample-tabs" className="contents">
              {TABS.map((tab) => (
                <li key={tab}>
                  <Link href={centrePath(centre.centre_id, tab)} className={tabLinkClass}>
                    {CENTRE_SECTION_TITLES[tab]}
                    <span className="sr-only"> for {centre.centre_name}</span>
                    <span aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </article>
  );
}

// Shown while the home is being picked.
export function SampleCentreFallback() {
  return (
    <section
      aria-busy="true"
      aria-label="Randomly picked centre"
      className="flex min-h-64 items-center justify-center rounded-2xl border border-line bg-surface p-6 text-sm text-ink-muted"
    >
      Picking a home at random…
    </section>
  );
}
