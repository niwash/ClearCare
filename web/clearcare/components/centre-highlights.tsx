// components/centre-highlights.tsx
import { formatDate, formatMonth, trailAnchor, type Highlight, type PromiseTrail } from "@/lib/centres";
import { JudgementIcon } from "./judgement-icon";

const COUNT_WORDS = ["", "one", "two", "three", "four", "five"];

function heading(highlight: Highlight) {
  switch (highlight.rule) {
    case "not-compliant-latest":
      return "Not compliant at the last inspection";
    case "repeated":
      return `Found at ${COUNT_WORDS[highlight.dates.length] ?? highlight.dates.length} inspections in a row`;
    case "promise-not-rejudged":
      return "Promised, then not re-judged";
  }
}

function dateLine({ rule, dates }: Highlight) {
  if (rule === "promise-not-rejudged" && dates.length === 2) {
    return `Promised ${formatMonth(dates[0])} · not assessed ${formatMonth(dates[1])}`;
  }
  const formatted = dates.map(formatDate);
  return formatted.length > 1 ? `${formatted.slice(0, -1).join(", ")} and ${formatted.at(-1)}` : formatted[0];
}

type CentreHighlightsProps = {
  highlights: Highlight[];
  trails: PromiseTrail[];
};

export function CentreHighlights({ highlights, trails }: CentreHighlightsProps) {
  if (highlights.length === 0) return null;

  return (
    <section aria-labelledby="first-h" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-col gap-1 border-b border-line-soft px-4 pb-4 pt-5 md:flex-row md:items-baseline md:justify-between md:gap-6 md:px-7">
        <h2 id="first-h" className="font-serif text-xl font-semibold md:text-2xl">
          What to look at first
        </h2>
        <p className="text-sm text-ink-muted">
          Chosen by rule, not by score. Every line is the inspector&apos;s or the provider&apos;s own words.
        </p>
      </div>

      <ul className="divide-y divide-line-soft">
        {highlights.map((highlight) => {
          const hasTrail = trails.some((trail) => trail.regulation.number === highlight.regulation.number);
          const anchor = `#${trailAnchor(highlight.regulation)}`;

          return (
            <li
              key={`${highlight.rule}-${highlight.regulation.number}`}
              className="grid gap-3 px-4 py-5 md:grid-cols-[15rem_minmax(0,1fr)_12rem] md:gap-7 md:px-7"
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-1">
                  <JudgementIcon judgement={highlight.judgement} size={16} />
                </span>
                <div>
                  <div className="font-semibold">{heading(highlight)}</div>
                  <div className="mt-0.5 text-sm text-ink-muted">{dateLine(highlight)}</div>
                </div>
              </div>

              <div>
                <div className="font-semibold">
                  Regulation {highlight.regulation.number} · {highlight.regulation.title}
                </div>
                <p className="mt-1.5 max-w-3xl leading-relaxed">
                  {highlight.text}
                  {hasTrail && (
                    <>
                      {" "}
                      <a href={anchor}>See what happened</a>
                    </>
                  )}
                </p>
              </div>

              <div className="text-sm leading-relaxed text-ink-muted">
                {highlight.sources.map((source) => (
                  <div key={source}>{source}</div>
                ))}
                {hasTrail ? (
                  <a href={anchor}>Open the trail</a>
                ) : (
                  highlight.reportUrl && <a href={highlight.reportUrl}>Read in the report</a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
