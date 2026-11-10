// components/centre/promise-trail.tsx
// One regulation's story on What happened next (CCARE-207, CCARE-212): what the inspector found, what
// the home said it would do, and what the next inspection found, told down a timeline rather than
// in three technical columns. Closed, it says the whole story in a line, with how it ended; open, each
// step has the report's own words and where they are.
import { formatDate, highlightAnchor, trailAnchor, type Inspection, type PromiseTrail as Trail } from "@/lib/centres";
import { ShowHide } from "@/components/ui/chevron";
import { ShowLess } from "@/components/ui/show-less";
import type { ReactNode } from "react";
import { askTheHome, inspectionDate, JudgementChip, OutcomePill, Quotes, RiskRating, SourceLink, trailOutcome } from "./finding-bits";
import { JUDGEMENT_LABELS } from "./judgement-icon";
import { sectionCardClass, sectionScrollMargin } from "./section-icon";

// One step of the timeline: a dot on the line, a heading with its date, and what happened.
function Step({ dot, title, date, last = false, children }: { dot: ReactNode; title: string; date?: string; last?: boolean; children: ReactNode }) {
  return (
    <li className="relative flex gap-4">
      {/* The line down to the next step. */}
      {!last && <span aria-hidden className="absolute top-8 bottom-0 left-[0.9375rem] w-px bg-line" />}
      <span aria-hidden className="relative grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-muted">
        {dot}
      </span>
      <div className={`flex min-w-0 flex-1 flex-col gap-3 pt-1 ${last ? "" : "pb-8"}`}>
        <h4 className="flex flex-wrap items-baseline gap-x-2.5 font-semibold text-ink">
          {title}
          {date && <span className="text-sm font-normal text-ink-muted">{date}</span>}
        </h4>
        {children}
      </div>
    </li>
  );
}

const inspectionsWord = (count: number) => (count === 1 ? "inspection" : `${count} inspections`);

type PromiseTrailProps = {
  trail: Trail;
  inspections: Inspection[];
  // What to look at first, where the regulation's highlight is (CCARE-212).
  highlightsHref: string;
  // What to ask, where this story's question is listed with the others.
  questionsHref: string;
};

export function PromiseTrail({ trail, inspections, highlightsHref, questionsHref }: PromiseTrailProps) {
  const { regulation, finding, promises, response, datesToComply, followUp, orderUnknown } = trail;
  const findingDate = inspectionDate(inspections, finding.inspectionId);
  const followUpDate = followUp && inspectionDate(inspections, followUp.inspectionId, followUp.date);
  const outcome = trailOutcome(trail);
  const question = askTheHome(outcome, findingDate);

  return (
    // A card that opens, like a guide's section, but with no shared name, so opening one leaves the
    // others as they are. The id is what the highlights and the history table link to, from their
    // own pages (CCARE-212); SectionAccordion opens it on arrival. "group/section" keeps Show/Hide to it.
    <details id={trailAnchor(regulation)} className={`group/section ${sectionScrollMargin} ${sectionCardClass}`}>
      <summary className="flex cursor-pointer list-none flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-7 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className="font-heading text-lg font-semibold md:text-xl">{regulation.title}</h3>
          <p className="text-sm text-ink-muted">
            Regulation {regulation.number}
            {findingDate && ` · found ${findingDate}`}
            <span className="sr-only">
              , {JUDGEMENT_LABELS[finding.judgement]}, then {outcome.label}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <OutcomePill outcome={outcome} />
          <ShowHide group="section" className="print:hidden" />
        </div>
      </summary>

      <div className="border-t border-line-soft px-5 pt-6 pb-6 md:px-7">
        <ol className="flex flex-col">
          <Step dot={<SearchDot />} title="What the inspector found" date={findingDate}>
            <div className="flex flex-wrap items-center gap-2">
              <JudgementChip judgement={finding.judgement} />
              {finding.risk && <RiskRating risk={finding.risk} />}
            </div>
            <Quotes quotes={finding.quotes} />
            <SourceLink source={finding.source} />
          </Step>

          <Step dot={<SpeechDot />} title="What the home said it would do">
            {promises.map((promise) => (
              <div key={promise.label} className="flex max-w-3xl flex-col gap-1.5 rounded-xl bg-surface-muted px-4 py-3 adult:rounded-md">
                <p className="text-sm font-semibold text-ink">
                  {promise.title ?? "Promised"}
                  {promise.due && <span className="font-normal text-ink-muted"> · by {promise.due}</span>}
                </p>
                <p className="leading-relaxed">“{promise.quote}”</p>
                <SourceLink source={promise.source} />
              </div>
            ))}
            {response && (
              <>
                <Quotes quotes={response.quotes} />
                <SourceLink source={response.source} />
              </>
            )}
            {promises.length === 0 && !response && (
              <p className="text-ink-muted">ClearCare doesn&apos;t have the home&apos;s response for this one.</p>
            )}
            {datesToComply && (
              <p className="text-small text-ink-muted">
                The compliance plan gives {datesToComply.map(formatDate).join(" and ")} as the
                date to put it right.
              </p>
            )}
          </Step>

          <Step dot={<FlagDot />} title="What happened next" date={followUpDate} last>
            {followUp ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {followUp.printedJudgement ? (
                    <span className="text-sm font-semibold">Judged “{followUp.printedJudgement}”</span>
                  ) : (
                    <JudgementChip judgement={followUp.judgement} />
                  )}
                  <OutcomePill outcome={outcome} />
                </div>
                {followUp.judgement === "not-assessed" && (
                  <p className="text-ink-muted">The next inspection didn&apos;t look at this regulation again.</p>
                )}
                {(followUp.between ?? 0) > 0 && (
                  <p className="text-sm text-ink-muted">
                    The {inspectionsWord(followUp.between!)} in between didn&apos;t look at it.
                  </p>
                )}
                {(followUp.notAssessedSince ?? 0) > 0 && (
                  <p className="text-sm text-ink-muted">Nor did the {inspectionsWord(followUp.notAssessedSince!)} since.</p>
                )}
                {followUp.quotes && followUp.source && (
                  <>
                    <Quotes quotes={followUp.quotes} />
                    <SourceLink source={followUp.source} />
                  </>
                )}
              </>
            ) : (
              <p className="text-ink-muted">
                {orderUnknown
                  ? "Two reports share the date it was next looked at, so we can't tell which came first. Both are in the inspection history."
                  : "There hasn't been an inspection since, so we don't know yet."}
              </p>
            )}
            {/* The question to take to the home, which depends on how it ended. */}
            <p className="flex max-w-3xl items-start gap-2.5 rounded-xl bg-tint-blue px-4 py-3 text-sm text-on-tint-blue adult:rounded-md adult:border adult:border-line">
              <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5" />
              </svg>
              <span>
                <span className="font-semibold">Worth asking the home:</span> {question}{" "}
                <a href={questionsHref} className="font-semibold whitespace-nowrap text-on-tint-blue print:hidden">
                  All questions <span aria-hidden>→</span>
                </a>
              </span>
            </p>
          </Step>
        </ol>

        {/* Back to the regulation's highlight on What to look at first, so nobody has to look for
            where they came from. Every trail has one: trails are only made for highlighted regulations. */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 print:hidden">
          <a
            href={`${highlightsHref}#${highlightAnchor(regulation)}`}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold tap-target"
          >
            <span aria-hidden>←</span> Back to What to look at first
          </a>
          {/* Closes the story from its end, as it can be long. */}
          <ShowLess className="print:hidden" />
        </div>
      </div>
    </details>
  );
}

// The timeline's dots: a magnifier for the finding, a speech bubble for the promise, a flag for the outcome.
const dotProps = { viewBox: "0 0 24 24", className: "size-4", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function SearchDot() {
  return (
    <svg {...dotProps}>
      <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
    </svg>
  );
}

function SpeechDot() {
  return (
    <svg {...dotProps}>
      <path d="M4 5h16v11H9l-5 4z" />
    </svg>
  );
}

function FlagDot() {
  return (
    <svg {...dotProps}>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}
