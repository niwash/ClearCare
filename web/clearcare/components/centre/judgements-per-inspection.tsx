// components/centre/judgements-per-inspection.tsx
import type { ReactNode } from "react";
import { formatDate, type Inspection, type Judgement, type RegulationHistory } from "@/lib/centres";
import { Icon } from "@/components/ui/icons";
import { JudgementIcon } from "./judgement-icon";

type AssessedJudgement = Exclude<Judgement, "not-assessed">;

// The order of the bar's segments and of the counts under it. "Not assessed" is left out: the
// bar counts what HIQA judged, and the table shows the rest.
const BAR_ORDER: AssessedJudgement[] = ["compliant", "substantially-compliant", "not-compliant"];

// The same colours as the judgement icons.
const BAR_COLOURS: Record<AssessedJudgement, string> = {
  compliant: "bg-ink",
  "substantially-compliant": "bg-substantially",
  "not-compliant": "bg-not-compliant",
};

const COUNT_LABELS: Record<AssessedJudgement, ReactNode> = {
  compliant: "compliant",
  "substantially-compliant": (
    <>
      substantially<span className="sr-only"> compliant</span>
    </>
  ),
  "not-compliant": "not compliant",
};

// From every regulation row, not only the rows the table shows.
function countJudgements(history: RegulationHistory[], inspection: Inspection) {
  const counts: Record<AssessedJudgement, number> = { compliant: 0, "substantially-compliant": 0, "not-compliant": 0 };
  for (const row of history) {
    const result = row.results[inspection.id];
    if (result) counts[result] += 1;
  }
  return counts;
}

// "the 4 latest inspections", or once every inspection is shown, "all 9 inspections".
function describeShown(shown: Inspection[], inspections: Inspection[]) {
  if (shown.length < inspections.length) return `the ${shown.length} latest inspections`;
  return shown.length === 1 ? "the only inspection" : `all ${shown.length} inspections`;
}

type JudgementsPerInspectionProps = {
  inspections: Inspection[];
  shown: Inspection[]; // the inspections the table shows
  history: RegulationHistory[];
};

export function JudgementsPerInspection({ inspections, shown, history }: JudgementsPerInspectionProps) {
  const counts = new Map(inspections.map((inspection) => [inspection.id, countJudgements(history, inspection)]));
  // One scale across every inspection, so an inspection that assessed fewer regulations has a
  // shorter bar, and showing all inspections doesn't resize the latest ones.
  const most = Math.max(
    ...[...counts.values()].map((count) => count.compliant + count["substantially-compliant"] + count["not-compliant"]),
  );

  // Closed until opened (CCARE-164: less scrolling), so the table follows the key straight away. The
  // same <details> pattern as the guides: no script, "Show" or "Hide" as well as the arrow, and
  // find-in-page still opens it.
  return (
    <details className="group border-t border-line-soft">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-5 md:px-7 [&::-webkit-details-marker]:hidden">
        {/* Says what is inside while it is closed: a bar chart, and how many inspections it covers. */}
        <div className="flex items-start gap-3">
          <Icon name="chart" className="mt-0.5 size-6 text-primary" />
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold">Judgments at each inspection</h3>
            {/* An invitation while closed; once open, what the chart shows. */}
            <p className="text-sm text-ink-muted group-open:hidden">Expand to see the chart of {describeShown(shown, inspections)}.</p>
            <p className="hidden text-sm text-ink-muted group-open:block">Number of judgments HIQA made at each inspection.</p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5 transition-transform group-open:rotate-90"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </span>
      </summary>
      <ul className="flex flex-col gap-4 px-4 pb-5 md:px-7">
        {shown.map((inspection) => {
          const inspectionCounts = counts.get(inspection.id)!;
          return (
            <li key={inspection.id} className="grid gap-1.5 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-6">
              <p className="text-sm text-ink-muted">
                <a href={inspection.reportUrl} className="font-mono font-medium text-ink no-underline hover:underline">
                  {formatDate(inspection.date)}
                </a>{" "}
                · {inspection.type}
              </p>
              {/* Inspections without regulation judgements have nothing to count. */}
              {inspection.regulationJudgements && (
                <div className="max-w-xl">
                  {/* The counts under it say the same, so screen readers skip the bar. md:mt-1 lines it
                      up with the date beside it. */}
                  <div aria-hidden className="flex h-3 gap-0.5 md:mt-1">
                    {BAR_ORDER.filter((judgement) => inspectionCounts[judgement] > 0).map((judgement) => (
                      <div
                        key={judgement}
                        className={`${BAR_COLOURS[judgement]} last:rounded-r-sm`}
                        style={{ width: `${(inspectionCounts[judgement] / most) * 100}%` }}
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {BAR_ORDER.map((judgement) => (
                      <span key={judgement} className="flex items-center gap-1.5 whitespace-nowrap">
                        <JudgementIcon judgement={judgement} size={12} />
                        {inspectionCounts[judgement]} {COUNT_LABELS[judgement]}
                      </span>
                    ))}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
