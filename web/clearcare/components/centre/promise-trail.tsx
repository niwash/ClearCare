// components/centre/promise-trail.tsx
import { formatDate, formatSource, highlightAnchor, trailAnchor, type Inspection, type PromiseTrail as Trail, type SourceRef } from "@/lib/centres";
import { ShowHide } from "@/components/ui/chevron";
import { LIST_ITEM } from "@/lib/findings";
import { JUDGEMENT_LABELS, JudgementIcon, PROMISE_STATUS_LABELS, PromiseStatusIcon } from "./judgement-icon";
import { contentsScrollMargin } from "./centre-contents";
import { sectionCardClass } from "./section-icon";

function Source({ source }: { source: SourceRef }) {
  return (
    <div className="font-mono text-xs text-ink-muted">
      {formatSource(source)}
      {source.url && (
        <>
          {" · "}
          <a href={source.url} className="font-sans">
            open page
          </a>
        </>
      )}
    </div>
  );
}

// The report's own words: its paragraphs, with each run of list items as a list.
function Quotes({ quotes }: { quotes: string[] }) {
  const blocks: (string | string[])[] = [];
  for (const quote of quotes) {
    if (!quote.startsWith(LIST_ITEM)) blocks.push(quote);
    else if (Array.isArray(blocks.at(-1))) (blocks.at(-1) as string[]).push(quote.slice(LIST_ITEM.length));
    else blocks.push([quote.slice(LIST_ITEM.length)]);
  }
  return (
    <blockquote className="flex flex-col gap-3 rounded-md bg-surface-muted px-3.5 py-3 text-sm leading-relaxed">
      {blocks.map((block, index) =>
        typeof block === "string" ? (
          <p key={index}>{block}</p>
        ) : (
          <ul key={index} className="flex list-disc flex-col gap-2 pl-5">
            {block.map((item, itemIndex) => (
              <li key={itemIndex}>{item}</li>
            ))}
          </ul>
        ),
      )}
    </blockquote>
  );
}

function StepHeading({ step, title, date }: { step: number; title: string; date?: string }) {
  return (
    <h4 className="flex items-baseline gap-2.5">
      <span className="font-mono text-small text-ink-muted">{step}</span>
      <span className="font-bold">{title}</span>
      {date && <span className="font-mono text-small text-ink-muted">{date}</span>}
    </h4>
  );
}

const inspectionsWord = (count: number) => (count === 1 ? "inspection" : `${count} inspections`);

type PromiseTrailProps = {
  trail: Trail;
  inspections: Inspection[];
};

export function PromiseTrail({ trail, inspections }: PromiseTrailProps) {
  const { regulation, finding, promises, response, datesToComply, followUp, orderUnknown } = trail;
  const dateOf = (id: string, fallback?: string) => {
    const date = inspections.find((candidate) => candidate.id === id)?.date ?? fallback;
    return date && formatDate(date);
  };
  // What happened in a line, so a closed trail still says it: the finding, then the next judgment.
  const findingDate = dateOf(finding.inspectionId);
  const next = followUp
    ? `${
        followUp.printedJudgement
          ? `judged “${followUp.printedJudgement}”`
          : followUp.judgement === "not-assessed"
            ? "not assessed"
            : JUDGEMENT_LABELS[followUp.judgement]
      }, ${dateOf(followUp.inspectionId, followUp.date) ?? "date unknown"}`
    : orderUnknown
      ? "next judgment unclear"
      : "no inspection since";

  return (
    // A card that opens, like a guide's section, but with no shared name, so opening one leaves the
    // others as they are. The id is what the highlights, the history table and the contents link
    // to; SectionAccordion opens it on arrival. "group/section" keeps Show/Hide to it.
    <details
      id={trailAnchor(regulation)}
      className={`group/section ${contentsScrollMargin} ${sectionCardClass} open:border-primary`}
    >
      {/* A summary may hold a heading but no wrapping block, so its parts are its own grid items. */}
      <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-4 md:px-6 [&::-webkit-details-marker]:hidden">
        <span className="row-span-2 self-start pt-1.5">
          <JudgementIcon judgement={finding.judgement} size={16} />
        </span>
        <h3 className="col-start-2 font-heading text-lg font-semibold md:text-xl">
          Regulation {regulation.number} · {regulation.title}
        </h3>
        <span className="col-start-2 text-sm text-ink-muted">
          {JUDGEMENT_LABELS[finding.judgement]}
          {findingDate && `, ${findingDate}`} <span aria-hidden>→</span>
          <span className="sr-only">, then</span> {next}
        </span>
        <ShowHide group="section" className="col-start-3 row-span-2 row-start-1 print:hidden" />
      </summary>

      <ol className="grid gap-7 border-t border-line-soft px-4 pb-7 pt-6 md:grid-cols-3 md:px-6">
        <li className="flex min-w-0 flex-col gap-3">
          <StepHeading step={1} title="The finding" date={dateOf(finding.inspectionId)} />
          <div className="flex items-center gap-2 text-sm">
            <JudgementIcon judgement={finding.judgement} />
            {JUDGEMENT_LABELS[finding.judgement]}
            {finding.risk && ` · risk rated ${finding.risk}`}
          </div>
          <Quotes quotes={finding.quotes} />
          <Source source={finding.source} />
        </li>

        <li className="flex min-w-0 flex-col gap-3">
          <StepHeading step={2} title="What the provider promised" />
          {promises.map((promise) => (
            <div key={promise.label} className="flex flex-col gap-1.5 rounded-md border border-line-soft px-3.5 py-3">
              <div className="text-sm font-semibold">
                {promise.label}
                {promise.title ? ` · ${promise.title}` : ` · due ${promise.due}`}
              </div>
              <p className="text-sm leading-relaxed">“{promise.quote}”</p>
              <div className="font-mono text-xs text-ink-muted">
                {promise.title && `due ${promise.due} · `}
                {formatSource(promise.source)}
                {promise.source.url && (
                  <>
                    {" · "}
                    <a href={promise.source.url} className="font-sans">
                      open page
                    </a>
                  </>
                )}
              </div>
            </div>
          ))}
          {response && (
            <>
              <Quotes quotes={response.quotes} />
              <Source source={response.source} />
            </>
          )}
          {promises.length === 0 && !response && (
            <p className="text-sm text-ink-muted">The report has no response from the provider for this regulation.</p>
          )}
          {datesToComply && (
            <p className="text-small leading-normal text-ink-muted">
              The plan&apos;s own table gives {datesToComply.map(formatDate).join(" and ")} as the date to comply.
              {promises.length > 0 && " The provider's dates above are shown as written."}
            </p>
          )}
        </li>

        <li className="flex min-w-0 flex-col gap-3">
          <StepHeading
            step={3}
            title={followUp?.between ? "When it was next judged" : "The next inspection"}
            date={followUp && dateOf(followUp.inspectionId, followUp.date)}
          />
          {followUp ? (
            <>
              <div className={`flex items-center gap-2 text-sm ${followUp.judgement === "not-assessed" ? "text-ink-muted" : ""}`}>
                <JudgementIcon judgement={followUp.judgement} />
                {followUp.printedJudgement
                  ? `Judged “${followUp.printedJudgement}”`
                  : followUp.judgement === "not-assessed"
                    ? `Regulation ${regulation.number} not assessed · no new judgment`
                    : JUDGEMENT_LABELS[followUp.judgement]}
              </div>
              {(followUp.between ?? 0) > 0 && (
                <p className="text-sm text-ink-muted">
                  The {inspectionsWord(followUp.between!)} in between didn&apos;t assess Regulation {regulation.number}.
                </p>
              )}
              {(followUp.notAssessedSince ?? 0) > 0 && (
                <p className="text-sm text-ink-muted">
                  Nor did the {inspectionsWord(followUp.notAssessedSince!)} since.
                </p>
              )}
              {followUp.quotes && followUp.source && (
                <>
                  <Quotes quotes={followUp.quotes} />
                  <Source source={followUp.source} />
                </>
              )}
              {followUp.updates.map((update) => {
                const promise = promises.find((candidate) => candidate.label === update.promiseLabel);
                return (
                  <div key={update.promiseLabel} className="flex flex-col gap-1.5 rounded-md border border-line-soft px-3.5 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <PromiseStatusIcon status={update.status} />
                      {update.promiseLabel} · {PROMISE_STATUS_LABELS[update.status]}
                      {promise?.title && <span className="sr-only">: {promise.title}</span>}
                    </div>
                    <p className="text-sm leading-relaxed">“{update.quote}”</p>
                    <Source source={update.source} />
                  </div>
                );
              })}
            </>
          ) : (
            <p className="text-sm text-ink-muted">
              {orderUnknown
                ? "Two reports share the date it was next judged, so which came first isn't known. Both are in the history above."
                : `No inspection since ${promises.length > 0 ? "the promise was made" : "this finding"}.`}
            </p>
          )}
        </li>
      </ol>

      {/* Back up to the regulation's highlight, so nobody has to scroll to find where they came from.
          Every trail has one: trails are only made for highlighted regulations. */}
      <div className="border-t border-line-soft px-4 py-3 text-sm font-semibold md:px-6">
        <a href={`#${highlightAnchor(regulation)}`} className="inline-flex min-h-11 items-center gap-1.5 tap-target">
          <span aria-hidden>↑</span> Back to What to look at first
        </a>
      </div>
    </details>
  );
}
