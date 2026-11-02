// The "A general guide by ClearCare" note for the family guide's flowchart. The flowchart on the
// page leaves it out so this can sit beside it as text; the downloadable PNG has it drawn in, so
// it stays with the chart when shared. Keep the wording the same as in that PNG.
export function GeneralGuideNote() {
  return (
    <aside className="max-w-4xl rounded-lg border border-line border-l-4 border-l-primary bg-surface px-5 py-4 md:text-lg">
      <span className="font-semibold">A general guide by ClearCare.</span> It shows the typical way to choose a nursing
      home, but every case is different. After a fall or a hospital stay, things may move faster, with less choice of
      home. This is not advice: check your own case with the HSE, a GP or a social worker.
    </aside>
  );
}
