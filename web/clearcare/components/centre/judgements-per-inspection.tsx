// components/centre/judgements-per-inspection.tsx
import type { ReactNode } from "react";
import { formatDate, type Inspection, type Judgement, type RegulationHistory } from "@/lib/centres";
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

  return (
    <div className="border-t border-line-soft px-4 py-5 md:px-7">
      <h3 className="font-semibold">Judgments at each inspection</h3>
      <p className="mt-1 text-sm text-ink-muted">Counts the regulations HIQA assessed on the day of each inspection.</p>
      <ul className="mt-4 flex flex-col gap-4">
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
    </div>
  );
}
