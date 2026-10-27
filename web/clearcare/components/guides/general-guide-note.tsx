// The "This is a general guide" note for the user journey flowchart. The flowchart on the page
// leaves it out so this can sit beside it as text; the downloadable PNG has it drawn in, so it
// stays with the chart when shared. Keep the wording the same as in that PNG; it still says "the
// usual way" where this says "the ideal way" (CCARE-164) until the PNG is redrawn.
export function GeneralGuideNote() {
  return (
    <aside className="max-w-4xl rounded-lg border border-line border-l-4 border-l-primary bg-surface px-5 py-4 md:text-lg">
      <span className="font-semibold">This is a general guide.</span> It shows the ideal way to choose a nursing home.
      It is not advice, and every case is different. After a fall or a hospital stay, things may move faster, with
      less choice of home. Check your own case with the HSE, a GP or a social worker.
    </aside>
  );
}
