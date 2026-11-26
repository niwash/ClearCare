// The look of a setting's button in the Display options panel (display-menu.tsx): filled, so it
// reads as something to press, which flat outlined buttons didn't there (CCARE-318). The primary
// colour in light mode (blue, or the adult-centred design's own) and white in dark mode. On or off
// shows in the words, ": On" or ": Off", not the colour.
export const toggleButtonClass =
  "flex min-h-11 w-full items-center gap-2 rounded-md bg-[light-dark(var(--primary),#ffffff)] px-3 py-2 text-left text-sm font-semibold text-on-primary shadow-sm transition-colors hover:bg-[light-dark(var(--primary-hover),#e8ecef)] motion-reduce:transition-none adult:transition-none";

// The words share a grid cell so the button has room for either from the first render.
// Screen readers hear the state from aria-pressed on the button.
export function ToggleState({ on }: { on: boolean | null }) {
  return (
    <span aria-hidden="true" className={`whitespace-nowrap${on === null ? " invisible" : ""}`}>
      {": "}
      <span className="inline-grid">
        <span className={`col-start-1 row-start-1${on ? "" : " invisible"}`}>On</span>
        <span className={`col-start-1 row-start-1${on ? " invisible" : ""}`}>Off</span>
      </span>
    </span>
  );
}
