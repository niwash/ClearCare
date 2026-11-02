"use client";

// The shortlist button for one home (CCARE-127). "toggle", on its page and its search result: "+ Add
// to shortlist", then a filled "✓ Added to shortlist" that takes it off again; once three homes are
// saved, a dashed button with a note on how to make room. "remove", on Compare Homes and in Your
// shortlist: "✕ Remove", or the ✕ alone where space is short. CompareStatus tells screen readers
// what happened.
import Link from "next/link";
import { compareHref, MAX_COMPARED, type ComparedHome } from "@/lib/compare";
import { addToCompare, announce, removeFromCompare, useComparedHomes } from "./compare-store";

const ICONS = {
  add: "M12 5v14M5 12h14",
  added: "M5 12l5 5 9-10",
  remove: "M6 6l12 12M18 6 6 18",
};

function ButtonIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function CompareButton({
  home,
  className,
  variant = "toggle",
  iconOnly = false,
  bare = false,
  focusAfter,
  fullNoteId,
}: {
  home: ComparedHome;
  // Size and layout only; the colours follow the state.
  className: string;
  variant?: "toggle" | "remove";
  iconOnly?: boolean;
  // A round ✕ with no border, for a chip that already has one (the search page's shortlist).
  bare?: boolean;
  // "remove": the id of an element to move focus to, as the button goes with its home.
  focusAfter?: string;
  // "toggle": the id of a note elsewhere on the page that says the list is full. Without one, the
  // button shows its own under it.
  fullNoteId?: string;
}) {
  const homes = useComparedHomes();
  const saved = homes?.some((entry) => entry.id === home.id) ?? false;
  const full = homes !== null && !saved && homes.length >= MAX_COMPARED;

  function remove() {
    if (homes === null) return;
    // Only ever removes: on Compare Homes the column stays until the server has drawn the page
    // without it, and a second click must not add the home back.
    if (saved) {
      removeFromCompare(home.id);
      announce(`${home.name} removed. ${homes.length - 1} of ${MAX_COMPARED} homes on your shortlist.`);
    }
    if (focusAfter) document.getElementById(focusAfter)?.focus();
  }

  function toggle() {
    if (homes === null || full) return;
    if (saved) {
      removeFromCompare(home.id);
      announce(`${home.name} removed. ${homes.length - 1} of ${MAX_COMPARED} homes on your shortlist.`);
    } else {
      addToCompare(home);
      announce(`${home.name} added. ${homes.length + 1} of ${MAX_COMPARED} homes on your shortlist.`);
    }
  }

  if (variant === "remove") {
    return (
      <button
        type="button"
        onClick={remove}
        disabled={homes === null}
        aria-label={iconOnly ? `Remove ${home.name} from your shortlist` : undefined}
        className={`${className} inline-flex items-center justify-center gap-1.5 font-semibold ${
          bare
            ? "rounded-full text-ink-muted hover:bg-surface hover:text-ink"
            : "rounded-md border border-line bg-surface text-ink hover:border-primary"
        }`}
      >
        <ButtonIcon name="remove" />
        {!iconOnly && (
          <>
            Remove<span className="sr-only"> {home.name} from your shortlist</span>
          </>
        )}
      </button>
    );
  }

  const stateClass = full
    ? "cursor-not-allowed border-2 border-dashed border-field bg-surface-muted text-ink-muted"
    : saved
      ? "border border-primary bg-primary text-on-primary hover:bg-primary-hover"
      : "border border-primary bg-surface text-primary hover:bg-surface-muted";
  const ownNoteId = `compare-full-${home.id}`;

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        // Disabled until hydration, when the saved list is known.
        disabled={homes === null}
        aria-pressed={full ? undefined : saved}
        aria-disabled={full || undefined}
        aria-describedby={full ? (fullNoteId ?? ownNoteId) : undefined}
        className={`${className} inline-flex items-center justify-center gap-1.5 rounded-md font-semibold ${stateClass}`}
      >
        {!full && <ButtonIcon name={saved ? "added" : "add"} />}
        {saved ? "Added to shortlist" : "Add to shortlist"}
        <span className="sr-only"> ({home.name})</span>
      </button>
      {full && homes && !fullNoteId && (
        // Its own line under the button: basis-full in a wrapping row, a line of its own in a column.
        <p id={ownNoteId} className="basis-full text-sm text-ink-muted">
          You can compare {MAX_COMPARED} homes at a time.{" "}
          <Link href={compareHref(homes.map((entry) => entry.id))} className="tap-target">
            Remove one
          </Link>{" "}
          to add this home.
        </p>
      )}
    </>
  );
}
