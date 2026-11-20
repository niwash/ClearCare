// components/centre/judgement-grid.tsx
// A home's judgments as a grid (CCARE-235), under the timeline on the Inspection history page: a row
// for each regulation that was a finding at least once, a column for each inspection, and in each
// cell the judgment's mark on a light fill of its colour. A reader sees at a glance which
// regulations keep coming up and which got better. The readers are mostly older, so the grid has
// the fewest words that say it: none in a cell, and the key at the top of the card explains the
// marks. The regulations that were compliant whenever they were judged are a bulleted list under it,
// the first few in view and the rest behind a "Show more" button. Which rows, in what order: judgementGrid
// (lib/judgements.ts).
import {
  formatDate,
  formatShortMonth,
  type Inspection,
  type Judgement,
  type PromiseTrail,
  type Regulation,
  type RegulationHistory,
} from "@/lib/centres";
import { judgementGrid, type Cell } from "@/lib/judgements";
import { regulationQuote } from "@/lib/regulations";
import { Definition } from "@/components/ui/definition";
import type { ReactNode } from "react";
import { HistoryScroller } from "./history-scroller";
import { JUDGEMENT_LABELS, JudgementIcon } from "./judgement-icon";
import { MoreRegulations } from "./more-regulations";
import { partHeaderClass, partHeadingClass } from "./section-icon";

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
// Every box the same size, and every row the same height (CCARE-258): 40px, as tall as a title of two
// lines, the most a title takes (see the title below), so the gap between boxes is the same everywhere,
// across a row and down a column. 44px in the adult-centred design, where a cell that links is a target
// (WCAG 2.5.5).
const cellBoxClass = "flex h-10 items-center justify-center rounded-md adult:h-11";

// A column is as narrow as the date over it allows, since on a phone each one saved brings another
// inspection into view. The gap between cells is padding, not the table's border-spacing: the
// titles' column stays in place over the cells that scroll under it, and spacing would let them
// show between its rows.
const cellClass = "min-w-12 p-[1.5px]";

// A cell is a mark, not a link (CCARE-258): it pointed to the finding's trail on How the home responded,
// but the record's words lead to their place on this page instead, and the grid does the same.
function GridCell({ cell, regulation, inspection }: { cell: Cell; regulation: Regulation; inspection: Inspection }) {
  const label = JUDGEMENT_LABELS[cell.judgement];
  const boxClass = `${cellBoxClass} ${CELL_CLASSES[cell.judgement]}`;
  const mark = cell.judgement !== "not-assessed" && <JudgementIcon judgement={cell.judgement} />;

  return (
    <td data-col={inspection.id} data-reg={regulation.number} data-judgement={cell.judgement} className={cellClass}>
      {/* What the mark means and when, on hover (CCARE-278): in user testing (P2_4) the participant
          wasn't sure what the marks meant. A screen reader already hears the judgement and the
          column's date. */}
      <span className={boxClass} title={`${label}, ${formatDate(inspection.date)}`}>
        {mark}
        <span className="sr-only">{label}</span>
      </span>
    </td>
  );
}


// A regulation's title, with HIQA's words for it a hover or tap away (CCARE-278): in user testing (P2_4)
// the participant didn't know what "Premises" meant. A regulation ClearCare has no quote for is its
// title alone; a clamped one keeps its whole title on hover.
function RegulationTitle({ regulation, className = "", children }: { regulation: Regulation; className?: string; children?: ReactNode }) {
  const quote = regulationQuote(regulation);
  const words = children ?? regulation.title;
  if (!quote) {
    return (
      <span className={className} title={regulation.title}>
        {words}
      </span>
    );
  }
  return (
    // HIQA's words in quotation marks, and which of HIQA's they are (lib/regulations.ts).
    <Definition
      title={`Regulation ${regulation.number}: ${regulation.title}`}
      meaning={`“${quote.text}”`}
      source={
        quote.kind === "standard"
          ? `HIQA National Standard ${quote.standard}, which this regulation is assessed against`
          : "What HIQA’s inspectors ask about this regulation"
      }
      className={className}
    >
      {words}
    </Definition>
  );
}

// Keeps the titles in place while the grid scrolls sideways.
const stickyClass = "sticky left-0 z-10 bg-surface";

type JudgementGridProps = {
  inspections: Inspection[];
  history: RegulationHistory[];
  trails: PromiseTrail[];
};

// How many of the always-compliant regulations are in view before "Show more": two rows of three
// columns on a wide screen. A fold that would hide only one or two hides nothing.
const REST_IN_VIEW = 6;
const REST_FOLD_AFTER = REST_IN_VIEW + 2;

// The rest of the list follows straight on from the part in view, with no gap between them, so it
// reads as one list once open (className="mt-2" only on the part in view).
function RestList({ regulations, className = "" }: { regulations: Regulation[]; className?: string }) {
  return (
    <ul aria-labelledby="rest-h" className={`list-disc gap-x-8 pl-5 font-medium sm:columns-2 ${className}`}>
      {regulations.map((regulation) => (
        <li key={regulation.number} className="break-inside-avoid py-0.5">
          {/* align-top: the title is a button, and a button sits on its last line, so a title that
              wraps had its bullet beside its second line rather than its first. */}
          <RegulationTitle regulation={regulation} className="align-top" />
        </li>
      ))}
    </ul>
  );
}

export function JudgementGrid({ inspections, history, trails }: JudgementGridProps) {
  const { columns, rows, rest } = judgementGrid(history, inspections, trails);
  const folds = rest.length > REST_FOLD_AFTER;
  const shown = folds ? rest.slice(0, REST_IN_VIEW) : rest;
  const hidden = folds ? rest.slice(REST_IN_VIEW) : [];

  return (
    <div>
      {/* Says which regulations are in the grid (CCARE-258): "Each regulation, inspection by
          inspection" read as all of them, but the rows are only those not fully compliant at least
          once; the rest are listed under it. Left out with no grid: the list's heading says it all. */}
      {rows.length > 0 && (
        <div id="grid-h" className={partHeaderClass}>
          <h3 className={partHeadingClass}>Regulations not fully compliant at least once</h3>
        </div>
      )}

      {rows.length > 0 && (
        <HistoryScroller>
          <table id="judgement-grid" aria-labelledby="grid-h" className="border-collapse">
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
                  <th scope="row" className={`${stickyClass} py-0.5 pr-3 text-left text-sm leading-snug font-normal`}>
                    {/* As narrow as two lines of most titles on a phone, where the room the titles
                        give up is judgments in view; no wider than a long title needs on a wide
                        screen. The scroll box keeps a focused cell clear of this column by its
                        narrowest width (history-scroller.tsx). */}
                    {/* The words in a span of their own, with a little padding, so the pill a marked title
                        gets (grid-title, globals.css) hugs each line of them, inside the column, without
                        moving them (CCARE-258). */}
                    {/* Two lines at most, so no row is taller than its boxes (CCARE-258): wide enough on a
                        phone (min-w-44) that the regulations' titles fit in two, and cut short with "…"
                        if one doesn't, its whole title still there for a screen reader and on hover. */}
                    {/* What the regulation is about on hover or tap (CCARE-278), with its whole title,
                        which replaces the title attribute that showed it on hover. */}
                    <RegulationTitle regulation={regulation} className="line-clamp-2 block max-w-72 min-w-44">
                      <span className="grid-title rounded-md px-1.5 py-0.5 box-decoration-clone">{regulation.title}</span>
                    </RegulationTitle>
                  </th>
                  {cells.map((cell, index) => (
                    <GridCell key={columns[index].id} cell={cell} regulation={regulation} inspection={columns[index]} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </HistoryScroller>
      )}

      {/* A bulleted list, the first few in view and the rest behind a "Show more" button, so a family sees
          what the list is without it outgrowing the grid. Columns on wider screens keep it short. */}
      {rest.length > 0 && (
        // Room between it and the grid above; with no grid there is nothing to keep it from.
        <div className={`text-sm ${rows.length > 0 ? "mt-8" : ""}`}>
          {/* A heading as large as the grid's (CCARE-278), with the count, so a family under a grid of
              findings sees the home still has compliant regulations. */}
          <div className={partHeaderClass}>
            <h3 id="rest-h" className={partHeadingClass}>
              Regulations always found compliant: {rest.length}
            </h3>
          </div>
          <RestList regulations={shown} className="mt-2" />
          {hidden.length > 0 && (
            <MoreRegulations count={hidden.length}>
              <RestList regulations={hidden} />
            </MoreRegulations>
          )}
        </div>
      )}

      <p className="mt-3 text-sm text-ink-muted">Reports before 2023 are available from HIQA on request.</p>
    </div>
  );
}
