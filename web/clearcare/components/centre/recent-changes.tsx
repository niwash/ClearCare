// components/centre/recent-changes.tsx
// What changed at a home in the last six months (CCARE-235), on the overview, where a family lands:
// a new registered provider or a new price would otherwise be found only on the Inspection history
// page. Each line is the date and what changed, in the timeline's words (rowWords in timeline.tsx),
// so a kind is worded once. A home with no recent change has no box.
//
// Taken off the overview in CCARE-258 and put back in CCARE-278, this time as a note: an "i" in a
// light amber box, as the site's other notes to take care (the guides' notes, National Figures), so
// it isn't read past as one more card of facts. The amber says "worth knowing", not good or bad:
// nothing here says how much a change matters.
import { formatDate } from "@/lib/centres";
import { recentChanges, type CentreEvent } from "@/lib/events";
import { Icon } from "@/components/ui/icons";
import Link from "next/link";
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
    <section
      aria-labelledby="changes-h"
      className="flex flex-col gap-4 rounded-2xl border border-on-tint-gold/30 bg-tint-gold p-4 text-ink md:p-5 adult:rounded-lg"
    >
      {/* The "i" beside the heading, so the box reads as a note before its words are read. */}
      <div className="flex items-start gap-3">
        <Icon name="info" className="mt-1 size-5 shrink-0 text-on-tint-gold" />
        <div className="flex flex-col gap-1">
          <h2 id="changes-h" className="font-heading text-xl font-semibold">
            Recent changes
          </h2>
          {/* Neither source says the day a change happened: the register is dated by the day it first
              showed the change (ADR-0031), a price by its list. The dates below must not read as that day. */}
          <p className="text-small text-on-tint-gold">
            In the last six months. Each is dated by the day HIQA&apos;s register or the HSE&apos;s price list showed it.
          </p>
        </div>
      </div>

      {/* In line with the heading's words, past the icon, from tablet width. */}
      <ol className="flex flex-col gap-3 sm:pl-8">
        {shown.map((event, index) => {
          const { body, words } = rowWords(event);
          return (
            // The date over the words on a phone, beside them from there up.
            <li key={index} className="grid gap-x-4 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
              <time dateTime={event.date} className="font-mono text-sm leading-6 text-on-tint-gold">
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
      <p className={`sm:pl-8 ${more > 0 ? "" : "print:hidden"}`}>
        {more > 0 && `${more} more ${more === 1 ? "change" : "changes"} in the last six months. `}
        <Link href={timelineHref} className="tap-target print:hidden">
          See everything that has happened at this home
        </Link>
      </p>
    </section>
  );
}
