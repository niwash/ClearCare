// components/centre/inspection-history.tsx
import { RecordPrintButton } from "@/components/centre/record-print";
import type { Inspection, PromiseTrail, RegulationHistory } from "@/lib/centres";
import type { CentreEvent } from "@/lib/events";
import { JudgementGrid } from "./judgement-grid";
import { JUDGEMENT_LABELS, JUDGEMENT_ORDER, JudgementIcon } from "./judgement-icon";
import { sectionCardClass, sectionHeadingClass, sectionScrollMargin } from "./section-icon";
import { Timeline } from "./timeline";

type InspectionHistoryProps = {
  inspections: Inspection[];
  history: RegulationHistory[];
  trails: PromiseTrail[];
  // The home's events, for the timeline the card opens with (CCARE-235). null when they couldn't be
  // read; the card then has the key and the grid alone.
  events: CentreEvent[] | null;
  // The page the trails are on, What happened next (CCARE-212).
  trailsHref: string;
};

export function InspectionHistory({ inspections, history, trails, events, trailsHref }: InspectionHistoryProps) {
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
        <div className="px-4 pb-4 pt-5 md:px-7">
          <ul aria-label="Key" className="flex flex-wrap gap-x-5 gap-y-1 text-base text-ink">
            {JUDGEMENT_ORDER.map((judgement) => (
              <li key={judgement} className="flex items-center gap-1.5">
                <JudgementIcon judgement={judgement} size={12} />
                {JUDGEMENT_LABELS[judgement]}
              </li>
            ))}
          </ul>
        </div>

        {/* Inside this section so it shares the key above: its inspection rows use the same marks. */}
        {events && events.length > 0 && (
          <div className="border-t border-line-soft px-4 py-5 md:px-7">
            <Timeline events={events} reports={{ inspections, history, trails, trailsHref }} />
          </div>
        )}

        {/* Open, not folded: it is the one place that shows every judgment, and the marks alone take
            little room. */}
        <div className="border-t border-line-soft px-4 py-5 md:px-7">
          <JudgementGrid inspections={inspections} history={history} trails={trails} trailsHref={trailsHref} />
        </div>
      </div>
    </section>
  );
}
