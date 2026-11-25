// components/ui/last-checked.tsx
// When a page's facts were last checked against its sources, so a reader knows how far to trust
// them: at the foot of Support Services, the regulations page and the guides that have been
// checked (CCARE-310). An "i" in a light amber box, as the notes in the guides (CCARE-233).
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icons";
import { lastCheckedLabel } from "@/lib/last-checked";

export function LastChecked({
  date,
  lead,
  children,
}: {
  // The day of the check ("2026-11-25"). A guide has one only once a check has found that its facts
  // agree with its sources (lib/guides.ts). One without it shows no note: a date there would tell
  // the reader to trust the guide more than they should.
  date: string | undefined;
  // What was checked, up to the date: "Contacts last checked".
  lead: string;
  // What the reader can do about a fact that has changed since, where the page has something to say.
  children?: ReactNode;
}) {
  if (!date) return null;

  return (
    <aside className="flex max-w-3xl items-start gap-3 rounded-lg border border-on-tint-gold/30 bg-tint-gold px-4 py-3 text-sm">
      <Icon name="info" className="size-5 shrink-0 text-on-tint-gold" />
      <p>
        <span className="font-semibold">
          {lead} <time dateTime={date}>{lastCheckedLabel(date)}</time>.
        </span>
        {children && <> {children}</>}
      </p>
    </aside>
  );
}
