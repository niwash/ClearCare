// components/centre/inspection-history.tsx
import { RecordPrintButton } from "@/components/centre/record-print";
import type { Inspection, PromiseTrail, RegulationHistory } from "@/lib/centres";
import type { CentreEvent } from "@/lib/events";
import { JudgementGrid } from "./judgement-grid";
import { judgementMeaning } from "@/lib/glossary";
import { JUDGEMENT_LABELS, JUDGEMENT_ORDER, JudgementIcon } from "./judgement-icon";
import { Definition } from "@/components/ui/definition";
import { sectionCardClass, sectionHeadingClass, sectionScrollMargin } from "./section-icon";
import { Timeline, TimelineNotes } from "./timeline";

// The most inspections the grid shows beside the timeline, at half the card's width.
const GRID_COLUMNS_BESIDE = 4;

type InspectionHistoryProps = {
  inspections: Inspection[];
  history: RegulationHistory[];
  trails: PromiseTrail[];
  // The home's events, for the timeline the card opens with (CCARE-235). null when they couldn't be
  // read; the card then has the key and the grid alone.
  events: CentreEvent[] | null;
  // The page the trails are on, How the home responded (CCARE-212).
  trailsHref: string;
  // When ClearCare last downloaded HIQA's register, said under the timeline (CCARE-258).
  updated?: string;
};

export function InspectionHistory({ inspections, history, trails, events, trailsHref, updated }: InspectionHistoryProps) {
  const hasTimeline = Boolean(events && events.length > 0);
  // The grid beside the timeline only while it has room for its columns there: up to four
  // inspections. With more, half the card hid the oldest behind a sideways scroll, so it goes under
  // the timeline, the card's whole width (CCARE-258).
  const judged = inspections.filter((inspection) => inspection.regulationJudgements).length;
  const beside = hasTimeline && judged <= GRID_COLUMNS_BESIDE;

  return (
    // The heading on the section's band, above the card, as "About this home" has; the key, the
    // timeline and the grid of judgments in the card.
    <section id="history" aria-labelledby="hist-h" className={`${sectionScrollMargin} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h2 id="hist-h" className={sectionHeadingClass}>
          Inspection history
        </h2>
        <RecordPrintButton />
      </div>
      <div className={sectionCardClass}>
        {/* On the band the compare page's group headings have (CCARE-278), so the key reads as the
            card's header, apart from the timeline and the grid under it it is the key to. Its top
            corners rounded as the card's are. Its own edge, in the band's line colour, laid over the
            card's (-m-px): the card's light edge disappeared against the band. */}
        <div className="-mx-px -mt-px rounded-t-2xl border border-b-0 border-section-line bg-section px-4 py-3 md:px-7 adult:rounded-t-lg">
          {/* Each judgement's meaning on hover or tap (CCARE-278), in the glossary's plain words
              (CCARE-283), so the key and /resources/glossary say the same thing. */}
          <ul aria-label="Key" className="flex flex-wrap gap-x-5 gap-y-1 text-base text-ink">
            {JUDGEMENT_ORDER.map((judgement) => (
              <li key={judgement} className="flex items-center gap-1.5">
                <JudgementIcon judgement={judgement} size={12} />
                <Definition
                  title={JUDGEMENT_LABELS[judgement]}
                  meaning={judgementMeaning(judgement)}
                >
                  {JUDGEMENT_LABELS[judgement]}
                </Definition>
              </li>
            ))}
          </ul>
        </div>

        {/* The timeline and the grid side by side from desktop width, a line between them (CCARE-258):
            one over the other, the timeline's rows left most of the card's width empty once its report
            links moved under the findings. One over the other on smaller screens, in one column no
            wider than the card (grid-cols-1, minmax(0, 1fr)): without it the column grew to the grid's
            whole table and the page scrolled sideways on a phone. */}
        <div className={`grid grid-cols-1 border-t border-section-line ${beside ? "lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]" : ""}`}>
          {/* Inside this section so it shares the key above: its inspection rows use the same marks. */}
          {events && events.length > 0 && (
            <div className="px-4 py-5 md:px-7">
              <Timeline events={events} reports={{ inspections, history, trails, trailsHref }} />
            </div>
          )}

          {/* Open, not folded: it is the one place that shows every judgment, and the marks alone take
              little room. Across the whole card when there is no timeline beside it. */}
          <div
            className={`px-4 py-5 md:px-7 ${
              !hasTimeline ? "" : beside ? "border-t border-line-soft lg:border-t-0 lg:border-l" : "border-t border-line-soft"
            }`}
          >
            <JudgementGrid inspections={inspections} history={history} trails={trails} />
          </div>
        </div>
      </div>
      {/* Under the card, outside it (CCARE-278): a footnote to the section, not the timeline's last row. */}
      {hasTimeline && <TimelineNotes events={events} updated={updated} />}
    </section>
  );
}
