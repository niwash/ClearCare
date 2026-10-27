// components/centre/inspection-history.tsx
import Link from "next/link";
import {
  changeFrom,
  formatDate,
  trailAnchor,
  type Change,
  type Inspection,
  type Judgement,
  type PromiseTrail,
  type RegulationHistory,
} from "@/lib/centres";
import { HistoryScroller } from "./history-scroller";
import { JUDGEMENT_LABELS, JUDGEMENT_ORDER, JudgementIcon } from "./judgement-icon";
import { JudgementsPerInspection } from "./judgements-per-inspection";

// Rows shown before "Show all".
const SHORT_LIST = 7;

const SHORT_LABELS: Record<Judgement, string> = {
  compliant: "Compliant",
  "substantially-compliant": "Substantially",
  "not-compliant": "Not compliant",
  "not-assessed": "Not assessed",
};

type Cell = {
  judgement: Judgement;
  change?: Change;
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

    if (result && result !== "compliant" && previous) cell.change = changeFrom(previous, result);
    if (result) previous = result;

    cell.trail = rowTrails.find((trail) => trail.finding.inspectionId === inspection.id);
    const followed = rowTrails.find((trail) => trail.followUp?.inspectionId === inspection.id);
    if (followed) cell.promisesTraced = { trail: followed, count: followed.promises.length };

    cells.set(inspection.id, cell);
  }
  return cells;
}

// Inspections shown before "Show all inspections": the most recent, which fit with full labels.
const LATEST_INSPECTIONS = 4;

function JudgementCell({ cell }: { cell: Cell }) {
  const label = (
    <>
      {SHORT_LABELS[cell.judgement]}
      {cell.judgement === "substantially-compliant" && <span className="sr-only"> compliant</span>}
    </>
  );

  return (
    <span className="flex items-start gap-2">
      {/* Lines the icon up with the first line of text. */}
      <span className="flex h-6 items-center">
        <JudgementIcon judgement={cell.judgement} />
      </span>
      <span>
        {cell.trail ? <a href={`#${trailAnchor(cell.trail.regulation)}`} className="inline-block py-1 tap-target">{label}</a> : label}
        {/* On their own line, so a wrapped label doesn't leave a "·" hanging. */}
        {cell.change && <span className="block text-sm text-ink-muted">{cell.change}</span>}
        {cell.promisesTraced && (
          <a href={`#${trailAnchor(cell.promisesTraced.trail.regulation)}`} className="block py-1 text-sm adult:flex adult:min-h-11 adult:items-center">
            {cell.promisesTraced.count} {cell.promisesTraced.count === 1 ? "promise" : "promises"} traced
          </a>
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
  showAllInspections: boolean;
};

// Column widths. With every inspection shown, each inspection column is wide enough for full
// labels and the table scrolls sideways instead of squeezing them.
const REGULATION_COLUMN_REM = 18;
const SCROLLING_COLUMN_REM = 10;

// Keeps the Regulation column in place while the table scrolls sideways. Its divider from the
// judgements is drawn inside the cell, since table borders don't stay with a sticky cell.
const stickyClass = "sticky left-0 z-10 after:absolute after:inset-y-0 after:right-0 after:w-0.5 after:bg-line";

// The "Show all / fewer" toggles: links styled as buttons, at least 44px tall (WCAG 2.5.5).
const toggleClass =
  "flex min-h-11 items-center justify-center rounded-md border-2 border-primary bg-surface px-4 py-2 font-semibold no-underline hover:bg-surface-muted";

// Keeps the other toggle when one toggle changes.
function historyHref({ regulations, inspections }: { regulations: boolean; inspections: boolean }) {
  const params = new URLSearchParams();
  if (regulations) params.set("regulations", "all");
  if (inspections) params.set("inspections", "all");
  return `?${params}#history`;
}

export function InspectionHistory({ inspections, history, trails, showAll, showAllInspections }: InspectionHistoryProps) {
  const rows = showAll ? history : history.slice(0, SHORT_LIST);
  // Cells are still built from every inspection, so "worse" and "better" compare with the right one.
  const shown = showAllInspections ? inspections : inspections.slice(-LATEST_INSPECTIONS);
  // More columns than fit: the table scrolls sideways, with the Regulation column fixed.
  const scrolls = shown.length > LATEST_INSPECTIONS;
  const firstYear = shown.length ? new Date(shown[0].date).getUTCFullYear() : null;
  const lastYear = shown.length ? new Date(shown[shown.length - 1].date).getUTCFullYear() : null;
  const years = firstYear === lastYear ? `${firstYear}` : `${firstYear}–${lastYear}`;

  return (
    <section id="history" aria-labelledby="hist-h" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-col gap-3 px-4 pb-4 pt-5 md:flex-row md:items-baseline md:justify-between md:px-7">
        <h2 id="hist-h" className="shrink-0 font-heading text-xl font-semibold md:text-2xl">
          Inspection history
        </h2>
        <ul aria-label="Key" className="flex flex-wrap gap-x-5 gap-y-1 text-base text-ink">
          {JUDGEMENT_ORDER.map((judgement) => (
            <li key={judgement} className="flex items-center gap-1.5">
              <JudgementIcon judgement={judgement} size={12} />
              {JUDGEMENT_LABELS[judgement]}
            </li>
          ))}
        </ul>
      </div>

      {/* Inside this section so it shares the key above and follows the same inspections toggle. */}
      <JudgementsPerInspection inspections={inspections} shown={shown} history={history} />

      {/* Phones and tablets, where the table's columns don't fit: one card per regulation,
          listing each inspection's result. */}
      <div className="border-t border-line-soft lg:hidden">
        {shown
          .filter((inspection) => !inspection.regulationJudgements)
          .map((inspection) => (
            <p
              key={inspection.id}
              className="mx-4 mt-4 rounded-md border border-line-soft bg-surface-muted px-3 py-2.5 text-sm leading-normal text-ink-muted"
            >
              <span className="font-mono font-medium text-ink">{formatDate(inspection.date)}</span> · {inspection.type}
              <br />
              {inspection.summary} <a href={inspection.reportUrl}>Read its findings</a>
            </p>
          ))}
        <ul className="divide-y-2 divide-line-soft">
          {rows.map((row) => {
            const cells = buildCells(row, inspections, trails);
            return (
              <li key={row.regulation.number} className="px-4 py-4">
                <h3 className="text-base">
                  <span className="font-mono text-sm text-ink-muted">#{row.regulation.number}</span> <span aria-hidden className="text-ink-muted">·</span>{" "}
                  {row.regulation.title}
                </h3>
                <dl className="mt-2.5 flex flex-col gap-1.5 text-base">
                  {shown.map((inspection) => {
                    const cell = cells.get(inspection.id);
                    if (!cell) return null;
                    return (
                      <div key={inspection.id} className="flex gap-4">
                        <dt className="w-28 shrink-0">
                          <a href={inspection.reportUrl} className="inline-block py-1 font-mono text-sm text-ink-muted no-underline hover:underline adult:underline tap-target-top">
                            {formatDate(inspection.date)}
                          </a>
                        </dt>
                        <dd className="min-w-0">
                          <JudgementCell cell={cell} />
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </li>
            );
          })}
        </ul>
      </div>

      <HistoryScroller scrolls={scrolls}>
        <table
          className="w-full min-w-[48rem] table-fixed text-left text-base"
          style={scrolls ? { width: `${REGULATION_COLUMN_REM + shown.length * SCROLLING_COLUMN_REM}rem` } : undefined}
        >
          <colgroup>
            <col style={{ width: `${REGULATION_COLUMN_REM}rem` }} />
          </colgroup>
          <thead className="bg-surface-muted">
            <tr className="border-b-2 border-line">
              <th scope="col" className={`${stickyClass} bg-surface-muted px-4 py-3 align-top text-sm font-normal text-ink-muted md:px-7`}>
                <span className="uppercase tracking-wide adult:normal-case adult:tracking-normal">Regulation #</span>
              </th>
              {shown.map((inspection) => (
                <th key={inspection.id} scope="col" className="px-4 py-3 align-top font-normal">
                  <a href={inspection.reportUrl} className="inline-block py-1 font-mono text-sm font-medium text-ink no-underline hover:underline adult:underline tap-target">
                    {formatDate(inspection.date)}
                  </a>
                  <div className="text-sm text-ink-muted">
                    {inspection.type}
                    {inspection.publishedDate && ` · published ${formatDate(inspection.publishedDate)}`}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const cells = buildCells(row, inspections, trails);
              return (
                <tr key={row.regulation.number} className="border-b-2 border-line-soft">
                  <th scope="row" className={`${stickyClass} bg-surface-muted px-4 py-3 font-normal md:px-7`}>
                    <span className="font-mono text-sm text-ink-muted">#{row.regulation.number}</span> <span aria-hidden className="text-ink-muted">·</span>{" "}
                    {row.regulation.title}
                  </th>
                  {shown.map((inspection) => {
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
                        className="border-x border-line-soft bg-[repeating-linear-gradient(135deg,var(--page)_0_8px,var(--surface)_8px_16px)] p-4 align-top text-sm leading-normal text-ink-muted"
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
      </HistoryScroller>

      {/* Three rows: what the table shows, the toggles, then the note about older reports. */}
      <div className="flex flex-col gap-3 px-4 pb-4 pt-4 text-base md:px-7">
        {/* Says what the table covers. */}
        {inspections.length > LATEST_INSPECTIONS && (
          // A status, so screen readers announce it when a toggle changes the inspections shown.
          <p role="status" className="text-ink">
            {showAllInspections
              ? `All ${inspections.length} inspections, ${years}.`
              : `Latest ${shown.length} of ${inspections.length} inspections, ${years}.`}
            {/* Only the table scrolls sideways; the phone cards stack instead. */}
            {scrolls && <span className="hidden lg:inline"> Scroll sideways for older inspections.</span>}
          </p>
        )}
        {(inspections.length > LATEST_INSPECTIONS || history.length > SHORT_LIST) && (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {inspections.length > LATEST_INSPECTIONS && (
              <Link
                href={historyHref({ regulations: showAll, inspections: !showAllInspections })}
                scroll={false}
                className={toggleClass}
              >
                {showAllInspections ? `Show latest ${LATEST_INSPECTIONS} only` : `Show all ${inspections.length} inspections`}
              </Link>
            )}
            {history.length > SHORT_LIST && (
              <Link
                href={historyHref({ regulations: !showAll, inspections: showAllInspections })}
                scroll={false}
                className={toggleClass}
              >
                {showAll
                  ? "Show fewer regulations"
                  : `Show all ${history.length} regulations`}
              </Link>
            )}
          </div>
        )}
        <p className="border-t border-line-soft pt-3 text-sm text-ink-muted">Reports before 2023 are available from HIQA on request.</p>
      </div>
    </section>
  );
}
