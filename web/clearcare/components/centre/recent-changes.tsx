// components/centre/recent-changes.tsx
// What changed at a home in the last six months (CCARE-235), on the overview, where a family lands:
// a new registered provider or a new price would otherwise be found only on the Inspection history
// page. Each line is the date and what changed, in the timeline's words (rowWords in timeline.tsx),
// so a kind is worded once. Nothing here says how much a change matters, and the box looks like any
// other. A home with no recent change has no box.
import { formatDate } from "@/lib/centres";
import { recentChanges, type CentreEvent } from "@/lib/events";
import Link from "next/link";
import { sectionCardClass } from "./section-icon";
import { rowWords } from "./timeline";

type RecentChangesProps = {
  events: CentreEvent[];
  // The day the six months are counted from, "2026-11-12".
  today: string;
  // The Chief Inspector's note as the register has it now, which the conditions box above quotes.
  currentNote: string | null;
  // The page the timeline is on.
  timelineHref: string;
};

export function RecentChanges({ events, today, currentNote, timelineHref }: RecentChangesProps) {
  const { shown, more } = recentChanges(events, today);
  if (shown.length === 0) return null;

  return (
    <section aria-labelledby="changes-h" className={`${sectionCardClass} flex flex-col gap-4 p-4 md:p-5`}>
      <div className="flex flex-col gap-1">
        <h2 id="changes-h" className="font-heading text-xl font-semibold">
          Recent changes
        </h2>
        {/* Neither source says the day a change happened: the register is dated by the day it first
            showed the change (ADR-0031), a price by its list. The dates below must not read as that day. */}
        <p className="text-small text-ink-muted">
          In the last six months. Each is dated by the day HIQA&apos;s register or the HSE&apos;s price list showed it.
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {shown.map((event, index) => {
          const { body, words } = rowWords(event);
          return (
            // The date over the words on a phone, beside them from there up.
            <li key={index} className="grid gap-x-4 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
              <time dateTime={event.date} className="font-mono text-sm leading-6 text-ink-muted">
                {formatDate(event.date)}
              </time>
              <div className="flex min-w-0 flex-col gap-0.5">
                {body}
                {/* HIQA's words are quoted once on the page. A condition that was added or changed,
                    and the note that stands, are in the conditions box above; quoted here too they
                    would read as two different things. A removed condition's words are on the
                    timeline. That leaves a note the register no longer has. */}
                {event.kind === "note_added" && event.text !== currentNote && words}
              </div>
            </li>
          );
        })}
      </ol>

      {/* A link can't be followed on paper, so there the line is only its count, when it has one. */}
      <p className={more > 0 ? undefined : "print:hidden"}>
        {more > 0 && `${more} more ${more === 1 ? "change" : "changes"} in the last six months. `}
        <Link href={timelineHref} className="tap-target print:hidden">
          See everything that has happened at this home
        </Link>
      </p>
    </section>
  );
}
