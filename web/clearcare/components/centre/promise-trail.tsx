// components/centre/promise-trail.tsx
import { formatDate, formatSource, trailAnchor, type Inspection, type PromiseTrail as Trail, type SourceRef } from "@/lib/centres";
import { JUDGEMENT_LABELS, JudgementIcon, PROMISE_STATUS_LABELS, PromiseStatusIcon } from "./judgement-icon";

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

function StepHeading({ step, title, date }: { step: number; title: string; date?: string }) {
  return (
    <h3 className="flex items-baseline gap-2.5">
      <span className="font-mono text-[13px] text-ink-muted">{step}</span>
      <span className="font-bold">{title}</span>
      {date && <span className="font-mono text-[13px] text-ink-muted">{date}</span>}
    </h3>
  );
}

type PromiseTrailProps = {
  trail: Trail;
  inspections: Inspection[];
};

export function PromiseTrail({ trail, inspections }: PromiseTrailProps) {
  const { regulation, finding, promises, planNote, followUp } = trail;
  const dateOf = (id: string) => {
    const inspection = inspections.find((candidate) => candidate.id === id);
    return inspection && formatDate(inspection.date);
  };
  const headingId = `${trailAnchor(regulation)}-h`;

  return (
    <section id={trailAnchor(regulation)} aria-labelledby={headingId} className="scroll-mt-6 rounded-lg border border-line bg-surface">
      <div className="border-b border-line-soft px-4 pb-4 pt-5 md:px-7">
        <h2 id={headingId} className="font-serif text-xl font-semibold md:text-2xl">
          Regulation {regulation.number} · {regulation.title}: what happened
        </h2>
      </div>

      <ol className="grid gap-7 px-4 pb-7 pt-6 md:grid-cols-3 md:px-7">
        <li className="flex flex-col gap-3">
          <StepHeading step={1} title="The finding" date={dateOf(finding.inspectionId)} />
          <div className="flex items-center gap-2 text-sm">
            <JudgementIcon judgement={finding.judgement} />
            {JUDGEMENT_LABELS[finding.judgement]}
            {finding.risk && ` · risk rated ${finding.risk}`}
          </div>
          <blockquote className="flex flex-col gap-3 rounded-md bg-surface-muted px-3.5 py-3 text-sm leading-relaxed">
            {finding.quotes.map((quote) => (
              <p key={quote}>“{quote}”</p>
            ))}
          </blockquote>
          <Source source={finding.source} />
        </li>

        <li className="flex flex-col gap-3">
          <StepHeading step={2} title="What the provider promised" />
          {promises.map((promise) => (
            <div key={promise.label} className="flex flex-col gap-1.5 rounded-md border border-line-soft px-3.5 py-3">
              <div className="text-sm font-semibold">
                {promise.label} · {promise.title}
              </div>
              <p className="text-sm leading-relaxed">“{promise.quote}”</p>
              <div className="font-mono text-xs text-ink-muted">
                due {promise.due} · {formatSource(promise.source)}
              </div>
            </div>
          ))}
          {planNote && <p className="text-[13px] leading-normal text-ink-muted">{planNote}</p>}
        </li>

        <li className="flex flex-col gap-3">
          <StepHeading step={3} title="The next inspection" date={followUp && dateOf(followUp.inspectionId)} />
          {followUp ? (
            <>
              <div className={`flex items-center gap-2 text-sm ${followUp.judgement === "not-assessed" ? "text-ink-muted" : ""}`}>
                <JudgementIcon judgement={followUp.judgement} />
                {followUp.judgement === "not-assessed"
                  ? `Regulation ${regulation.number} not assessed · no new judgment`
                  : JUDGEMENT_LABELS[followUp.judgement]}
              </div>
              {followUp.updates.map((update) => {
                const promise = promises.find((candidate) => candidate.label === update.promiseLabel);
                return (
                  <div key={update.promiseLabel} className="flex flex-col gap-1.5 rounded-md border border-line-soft px-3.5 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <PromiseStatusIcon status={update.status} />
                      {update.promiseLabel} · {PROMISE_STATUS_LABELS[update.status]}
                      {promise && <span className="sr-only">: {promise.title}</span>}
                    </div>
                    <p className="text-sm leading-relaxed">“{update.quote}”</p>
                    <Source source={update.source} />
                  </div>
                );
              })}
            </>
          ) : (
            <p className="text-sm text-ink-muted">No inspection since the promise was made.</p>
          )}
        </li>
      </ol>
    </section>
  );
}
