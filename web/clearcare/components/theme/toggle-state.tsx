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
