// components/inspection-history.tsx
import Link from "next/link";
import {
  formatDate,
  formatMonth,
  trailAnchor,
  type Inspection,
  type Judgement,
  type PromiseTrail,
  type RegulationHistory,
} from "@/lib/centres";
import { JUDGEMENT_LABELS, JUDGEMENT_ORDER, JudgementIcon } from "./judgement-icon";

// Rows shown before "Show all".
const SHORT_LIST = 7;

const SEVERITY: Record<Exclude<Judgement, "not-assessed">, number> = {
  compliant: 0,
  "substantially-compliant": 1,
  "not-compliant": 2,
};

const SHORT_LABELS: Record<Judgement, string> = {
  compliant: "Compliant",
  "substantially-compliant": "Substantially",
  "not-compliant": "Not compliant",
  "not-assessed": "Not assessed",
};

type Cell = {
  judgement: Judgement;
  change?: "same" | "worse" | "better";
  trail?: PromiseTrail; // this inspection made the finding the trail starts from
  promisesTraced?: { trail: PromiseTrail; count: number }; // this inspection followed the promises up
};

// Only non-compliant judgements get a "same"/"worse"/"better" note, compared with the
// last inspection that assessed the regulation.
function buildCells(row: RegulationHistory, inspections: Inspection[], trails: PromiseTrail[]) {
  const rowTrails = trails.filter((trail) => trail.regulation.number === row.regulation.number);
  let previous: Exclude<Judgement, "not-assessed"> | undefined;
  const cells = new Map<string, Cell>();

  for (const inspection of inspections) {
    if (!inspection.regulationJudgements) continue;
    const result = row.results[inspection.id];
    const cell: Cell = { judgement: result ?? "not-assessed" };

    if (result && result !== "compliant" && previous) {
      const difference = SEVERITY[result] - SEVERITY[previous];
      cell.change = difference === 0 ? "same" : difference > 0 ? "worse" : "better";
    }
    if (result) previous = result;

    cell.trail = rowTrails.find((trail) => trail.finding.inspectionId === inspection.id);
    const followed = rowTrails.find((trail) => trail.followUp?.inspectionId === inspection.id);
    if (followed) cell.promisesTraced = { trail: followed, count: followed.promises.length };

    cells.set(inspection.id, cell);
  }
  return cells;
}

function JudgementCell({ cell }: { cell: Cell }) {
  const label = (
    <>
      {SHORT_LABELS[cell.judgement]}
      {cell.judgement === "substantially-compliant" && <span className="sr-only"> compliant</span>}
    </>
  );

  return (
    <span className={`flex items-center gap-2 ${cell.judgement === "not-assessed" ? "text-ink-muted" : ""}`}>
      <JudgementIcon judgement={cell.judgement} />
      <span>
        {cell.trail ? <a href={`#${trailAnchor(cell.trail.regulation)}`}>{label}</a> : label}
        {cell.change && ` · ${cell.change}`}
        {cell.promisesTraced && (
          <>
            {" · "}
            <a href={`#${trailAnchor(cell.promisesTraced.trail.regulation)}`}>
              {cell.promisesTraced.count} {cell.promisesTraced.count === 1 ? "promise" : "promises"} traced
            </a>
          </>
        )}
      </span>
    </span>
  );
}

type InspectionHistoryProps = {
  inspections: Inspection[];
  history: RegulationHistory[];
  trails: PromiseTrail[];
  showAll: boolean;
};

export function InspectionHistory({ inspections, history, trails, showAll }: InspectionHistoryProps) {
  const rows = showAll ? history : history.slice(0, SHORT_LIST);
  const firstJudged = inspections.find((inspection) => inspection.regulationJudgements);

  return (
    <section id="history" aria-labelledby="hist-h" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-col gap-3 px-4 pb-4 pt-5 md:flex-row md:items-baseline md:justify-between md:px-7">
        <h2 id="hist-h" className="font-serif text-xl font-semibold md:text-2xl">
          Inspection history
        </h2>
        <ul aria-label="Key" className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
          {JUDGEMENT_ORDER.map((judgement) => (
            <li key={judgement} className="flex items-center gap-1.5">
              <JudgementIcon judgement={judgement} size={12} />
              {judgement === "not-assessed" ? "Not assessed at that inspection" : JUDGEMENT_LABELS[judgement]}
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-x-auto border-t border-line-soft">
        <table className="w-full min-w-[48rem] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[18rem]" />
          </colgroup>
          <thead className="bg-surface-muted">
            <tr className="border-b border-line-soft">
              <th scope="col" className="px-4 py-3 align-top text-xs font-normal uppercase tracking-wide text-ink-muted md:px-7">
                Regulation
              </th>
              {inspections.map((inspection) => (
                <th key={inspection.id} scope="col" className="px-4 py-3 align-top font-normal">
                  <a href={inspection.reportUrl} className="font-mono text-[13px] font-medium text-ink no-underline hover:underline">
                    {formatDate(inspection.date)}
                  </a>
                  <div className="text-xs text-ink-muted">
                    {inspection.type} · published {formatDate(inspection.publishedDate)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const cells = buildCells(row, inspections, trails);
              return (
                <tr key={row.regulation.number} className="border-b border-line-soft">
                  <th scope="row" className="px-4 py-3 font-normal md:px-7">
                    <span className="font-mono text-[13px] text-ink-muted">{row.regulation.number}</span>{" "}
                    {row.regulation.title}
                  </th>
                  {inspections.map((inspection) => {
                    const cell = cells.get(inspection.id);
                    if (cell) {
                      return (
                        <td key={inspection.id} className="px-4 py-3">
                          <JudgementCell cell={cell} />
                        </td>
                      );
                    }
                    // Inspections without regulation judgements get one cell down the whole column.
                    if (rowIndex > 0) return null;
                    return (
                      <td
                        key={inspection.id}
                        rowSpan={rows.length}
                        className="border-x border-line-soft bg-[repeating-linear-gradient(135deg,var(--page)_0_8px,var(--surface)_8px_16px)] p-4 align-top text-[13px] leading-normal text-ink-muted"
                      >
                        <div className="rounded-md border border-line-soft bg-surface px-3 py-2.5">
                          {inspection.summary} <a href={inspection.reportUrl}>Read its findings</a>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-1 px-4 py-3.5 text-sm md:flex-row md:justify-between md:px-7">
        {history.length > SHORT_LIST ? (
          <Link href={showAll ? "?#history" : "?regulations=all#history"} scroll={false}>
            {showAll
              ? "Show fewer regulations"
              : `Show all ${history.length} regulations assessed${firstJudged ? ` since ${formatMonth(firstJudged.date)}` : ""}`}
          </Link>
        ) : (
          <span />
        )}
        <span className="text-ink-muted">Reports before 2023 are available from HIQA on request.</span>
      </div>
    </section>
  );
}
