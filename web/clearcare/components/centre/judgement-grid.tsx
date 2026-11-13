// components/centre/judgement-grid.tsx
// A home's judgments as a grid (CCARE-235), under the timeline on the Inspection history page: a row
// for each regulation that was a finding at least once, a column for each inspection, and in each
// cell the judgment's mark on a light fill of its colour. A reader sees at a glance which
// regulations keep coming up and which got better. The readers are mostly older, so the grid has
// the fewest words that say it: none in a cell, and the key at the top of the card explains the
// marks. The regulations that were compliant whenever they were judged are one line under it. Which
// rows, in what order: judgementGrid (lib/judgements.ts).
import { ShowHide } from "@/components/ui/chevron";
import {
  formatDate,
  formatShortMonth,
  trailAnchor,
  type Inspection,
  type Judgement,
  type PromiseTrail,
  type Regulation,
  type RegulationHistory,
} from "@/lib/centres";
import { judgementGrid, type Cell } from "@/lib/judgements";
import { HistoryScroller } from "./history-scroller";
import { JUDGEMENT_LABELS, JudgementIcon } from "./judgement-icon";

// What is behind a cell's mark. How strong the fills are is set once, in globals.css
// (--finding-fill-strength). A regulation the inspection did not judge has no mark and no fill, only
// a faint dashed edge, so the judgments stand out from the gaps between them.
const CELL_CLASSES: Record<Judgement, string> = {
  "not-compliant": "bg-not-compliant-fill",
  "substantially-compliant": "bg-substantially-fill",
  compliant: "bg-compliant-fill",
  "not-assessed": "border border-dashed border-line adult:border-line-soft",
};

// A cell's box. Its width is its column's (cellClass); it is 44px tall in the adult-centred design,
// where a cell that links is a target (WCAG 2.5.5).
const cellBoxClass = "flex h-7.5 items-center justify-center rounded-md adult:h-11";

// A column is as narrow as the date over it allows, since on a phone each one saved brings another
// inspection into view. The gap between cells is padding, not the table's border-spacing: the
// titles' column stays in place over the cells that scroll under it, and spacing would let them
// show between its rows.
const cellClass = "min-w-12 p-[1.5px]";

function GridCell({ cell, regulation, inspection, trailsHref }: { cell: Cell; regulation: Regulation; inspection: Inspection; trailsHref: string }) {
  const label = JUDGEMENT_LABELS[cell.judgement];
  const boxClass = `${cellBoxClass} ${CELL_CLASSES[cell.judgement]}`;
  const mark = cell.judgement !== "not-assessed" && <JudgementIcon judgement={cell.judgement} />;

  return (
    <td className={cellClass}>
      {cell.trail ? (
        // To the finding's trail on What happened next. Tabbed to, a link is heard without its row's
        // and column's headers, so its name says all three.
        <a href={`${trailsHref}#${trailAnchor(cell.trail.regulation)}`} className={`${boxClass} hover:outline-2 hover:outline-ink`}>
          {mark}
          <span className="sr-only">
            {regulation.title}: {label.toLowerCase()}, {formatDate(inspection.date)}
          </span>
        </a>
      ) : (
        <span className={boxClass}>
          {mark}
          <span className="sr-only">{label}</span>
        </span>
      )}
    </td>
  );
}

// "16 other regulations: compliant whenever they were judged." Of a home where no regulation was
// ever a finding there is no grid for them to be other than, so it is "All 14 regulations".
function restWords(count: number, hasRows: boolean) {
  const regulations = count === 1 ? "regulation" : "regulations";
  const judged = count === 1 ? "it was" : "they were";
  // Not "All 1": that is not English.
  const subject = hasRows ? `${count} other ${regulations}` : count === 1 ? `1 ${regulations}` : `All ${count} ${regulations}`;
  return `${subject}: compliant whenever ${judged} judged.`;
}

// Keeps the titles in place while the grid scrolls sideways.
const stickyClass = "sticky left-0 z-10 bg-surface";

type JudgementGridProps = {
  inspections: Inspection[];
  history: RegulationHistory[];
  trails: PromiseTrail[];
  // The page the trails are on, What happened next (CCARE-212).
  trailsHref: string;
};

export function JudgementGrid({ inspections, history, trails, trailsHref }: JudgementGridProps) {
  const { columns, rows, rest } = judgementGrid(history, inspections, trails);

  return (
    <div>
      {/* Left out when no report judged a regulation: thematic inspections alone. */}
      {(rows.length > 0 || rest.length > 0) && (
        <h3 id="grid-h" className="font-semibold">
          Each regulation, inspection by inspection
        </h3>
      )}

      {rows.length > 0 && (
        <HistoryScroller>
          <table aria-labelledby="grid-h" className="border-collapse">
            <thead>
              <tr>
                <th scope="col" className={stickyClass}>
                  <span className="sr-only">Regulation</span>
                </th>
                {columns.map((inspection) => (
                  // Not in the mono face the site's other dates have: its wide space would set
                  // "Jul 23" no closer together than it is to the next column's date.
                  <th key={inspection.id} scope="col" className="px-[3px] pb-1 text-center text-small font-medium whitespace-nowrap text-ink-muted tabular-nums">
                    {/* The month heads the column; a screen reader hears the day too, which tells
                        two inspections of one month apart. */}
                    <time dateTime={inspection.date}>
                      <span aria-hidden>{formatShortMonth(inspection.date)}</span>
                      <span className="sr-only">{formatDate(inspection.date)}</span>
                    </time>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ regulation, cells }) => (
                <tr key={regulation.number}>
                  <th scope="row" className={`${stickyClass} py-1 pr-3 text-left text-sm leading-snug font-normal`}>
                    {/* As narrow as two lines of most titles on a phone, where the room the titles
                        give up is judgments in view; no wider than a long title needs on a wide
                        screen. The scroll box keeps a focused cell clear of this column by its
                        narrowest width (history-scroller.tsx). */}
                    <span className="block max-w-72 min-w-36">{regulation.title}</span>
                  </th>
                  {cells.map((cell, index) => (
                    <GridCell key={columns[index].id} cell={cell} regulation={regulation} inspection={columns[index]} trailsHref={trailsHref} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </HistoryScroller>
      )}

      {/* The same <details> as the site's other folds: no script, and print opens it (globals.css). */}
      {rest.length > 0 && (
        <details className="group mt-1 text-sm text-ink-muted">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-2 [&::-webkit-details-marker]:hidden">
            <span>{restWords(rest.length, rows.length > 0)}</span>
            <ShowHide className="print:hidden" />
          </summary>
          <ul className="gap-x-8 pb-3 sm:columns-2 lg:columns-3">
            {rest.map((regulation) => (
              <li key={regulation.number} className="break-inside-avoid py-0.5">
                {regulation.title}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-3 text-sm text-ink-muted">Reports before 2023 are available from HIQA on request.</p>
    </div>
  );
}
