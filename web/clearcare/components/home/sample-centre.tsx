// components/home/sample-centre.tsx
// The start page's example home. Rendered on the server inside <Suspense>, so the rest of the
// page arrives first and this streams in when the home has been picked.
import Link from "next/link";
import { JUDGEMENT_LABELS, JudgementIcon } from "@/components/centre/judgement-icon";
import { formatDate } from "@/lib/centres";
import { getSampleCentre } from "@/lib/sample-centre";

// Findings listed before "and N more".
const SHORT_LIST = 5;

const COUNT_ORDER = ["not-compliant", "substantially-compliant", "compliant"] as const;

export async function SampleCentre({ total }: { total: number | null }) {
  const sample = await getSampleCentre(total);
  // Nothing could be read: leave the space empty rather than show a broken example.
  if (!sample) return null;

  const { centre, latest, reportCount, firstYear, counts, findings } = sample;
  const assessed = counts.compliant + counts["substantially-compliant"] + counts["not-compliant"];
  const shown = findings.slice(0, SHORT_LIST);

  return (
    <section aria-labelledby="sample-h" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-col gap-1 border-b border-line-soft px-4 pb-4 pt-5 md:px-7">
        <p className="text-xs uppercase tracking-wider text-ink-muted">Randomly picked centre</p>
        <h2 id="sample-h" className="font-serif text-xl font-semibold md:text-2xl">
          <Link href={`/centres/${centre.centre_id}`} className="text-ink tap-target">
            {centre.centre_name}
          </Link>
        </h2>
        <p className="text-sm text-ink-muted">
          Co. {centre.county} · {reportCount} {reportCount === 1 ? "report" : "reports"} since {firstYear}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-4 py-5 md:px-7">
        <p>
          Latest inspection (
          <a href={latest.reportUrl}>
            {latest.type.toLowerCase()}, {formatDate(latest.date)}
          </a>
          ): {assessed} {assessed === 1 ? "regulation" : "regulations"} assessed
        </p>

        <ul aria-label="Judgements at the latest inspection" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {COUNT_ORDER.map((judgement) => (
            <li key={judgement} className="flex items-center gap-2">
              <JudgementIcon judgement={judgement} />
              <span>
                <span className="font-semibold">{counts[judgement]}</span> {JUDGEMENT_LABELS[judgement].toLowerCase()}
              </span>
            </li>
          ))}
        </ul>

        {findings.length === 0 ? (
          <p className="text-sm text-ink-muted">All assessed regulations were compliant.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Not fully compliant</h3>
            <ul className="divide-y divide-line-soft rounded-md border border-line-soft">
              {shown.map(({ regulation, judgement, change }) => (
                <li key={regulation.number} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                  <span className="mt-0.5">
                    <JudgementIcon judgement={judgement} />
                  </span>
                  {/* The label goes under the title on small screens, beside it on wider ones. */}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                    <span>
                      <span className="font-mono text-small text-ink-muted">{regulation.number}</span> {regulation.title}
                    </span>
                    <span className="text-ink-muted sm:shrink-0 sm:text-right">
                      {JUDGEMENT_LABELS[judgement]}
                      {change && ` · ${change === "same" ? "same as" : `${change} than`} last time`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {findings.length > shown.length && (
              <p className="text-sm text-ink-muted">and {findings.length - shown.length} more.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-line-soft px-4 py-3.5 text-sm md:flex-row md:justify-between md:px-7">
        <Link href={`/centres/${centre.centre_id}`} className="tap-target">See full record<span className="sr-only"> for {centre.centre_name}</span> →</Link>
        {/* A plain link, so the browser reloads the page and the server picks again. */}
        <a href="/home" className="tap-target">Show another home</a>
      </div>
    </section>
  );
}

// Shown while the home is being picked.
export function SampleCentreFallback() {
  return (
    <section
      aria-busy="true"
      aria-label="Randomly picked centre"
      className="flex min-h-64 items-center justify-center rounded-lg border border-line bg-surface p-6 text-sm text-ink-muted"
    >
      Picking a home at random…
    </section>
  );
}
