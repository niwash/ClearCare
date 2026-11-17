// The "A general guide by ClearCare" note for the family guide's flowchart. The flowchart on the
// page leaves it out so this can sit beside it as text; the downloadable PNG has it drawn in, so
// it stays with the chart when shared. Keep the wording the same as in that PNG.
// An "i" in a light amber box, as the note in the nursing home checklist (CCARE-233): a note to
// take care, not an idea, and not alarming enough for a warning sign.
import { Icon } from "@/components/ui/icons";

export function GeneralGuideNote() {
  return (
    <aside className="flex max-w-4xl items-start gap-3 rounded-lg border border-on-tint-gold/30 bg-tint-gold px-5 py-4 md:text-lg">
      <Icon name="info" className="mt-0.5 size-5 shrink-0 text-on-tint-gold md:mt-1" />
      <p>
        <span className="font-semibold">A general guide by ClearCare.</span> It shows the typical way to choose a
        nursing home, but every case is different. After a fall or a hospital stay, things may move faster, with less
        choice of home. This is not advice: check your own case with the HSE, a GP or a social worker.
      </p>
    </aside>
  );
}
