"use client";

// components/centre/show-in-grid.tsx
// The regulations an inspection's row on the timeline names as not compliant, or "4 not compliant"
// where it counts them, as words that point to them in the grid of judgments beside the timeline
// (CCARE-258). Pressed, the matching cells of that inspection's column are marked, with their titles,
// until pressed again or another one is pressed: one marked at a time. A pointer resting on the words
// shows the mark for as long as it rests there. Words with a dotted underline rather than a button
// or a link: they lead nowhere else, they only show where the thing is. The grid's cells say their
// inspection, regulation and judgment (data-col, data-reg, data-judgement, judgement-grid.tsx); the
// mark is a class on them (grid-marked, globals.css), so the grid, drawn on the server, needs no state
// of its own. Pressing also brings them into view: on a phone the grid is under the timeline.
import { useEffect, useState, type ReactNode } from "react";

const MARKED = "grid-marked";
// Which words are pressed, said to all of them, so the others let go of theirs.
const PRESSED_EVENT = "clearcare:grid-pressed";
let pressedNow: string | null = null;

type ShowInGridProps = {
  inspectionId: string;
  // One regulation, by number; without it, every regulation the inspection judged not compliant.
  regulation?: number;
  children: ReactNode;
};

function cellsFor(inspectionId: string, regulation?: number) {
  const grid = document.getElementById("judgement-grid");
  if (!grid) return [];
  const which = regulation === undefined ? '[data-judgement="not-compliant"]' : `[data-reg="${regulation}"]`;
  const cells = [...grid.querySelectorAll<HTMLElement>(`td[data-col="${CSS.escape(inspectionId)}"]${which}`)];
  const titles = cells.map((cell) => cell.closest("tr")?.querySelector<HTMLElement>("th")).filter((title) => title != null);
  return [...cells, ...titles];
}

function clearMarks() {
  document.querySelectorAll(`#judgement-grid .${MARKED}`).forEach((element) => element.classList.remove(MARKED));
}

function mark(key: string | null) {
  clearMarks();
  if (!key) return;
  const [inspectionId, regulation] = key.split(":");
  cellsFor(inspectionId, regulation === "all" ? undefined : Number(regulation)).forEach((element) => element.classList.add(MARKED));
}

export function ShowInGrid({ inspectionId, regulation, children }: ShowInGridProps) {
  const key = `${inspectionId}:${regulation ?? "all"}`;
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const listener = () => setPressed(pressedNow === key);
    addEventListener(PRESSED_EVENT, listener);
    return () => removeEventListener(PRESSED_EVENT, listener);
  }, [key]);

  function press() {
    pressedNow = pressedNow === key ? null : key;
    mark(pressedNow);
    dispatchEvent(new Event(PRESSED_EVENT));
    if (!pressedNow) return;

    // Where the grid is out of sight below (phones and tablets), the window goes to the grid's heading;
    // the column is brought into the middle of the grid's own scroll box.
    const grid = document.getElementById("judgement-grid");
    const first = grid?.querySelector<HTMLElement>(`td.${MARKED}`);
    if (!grid || !first) return;
    const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    const heading = document.getElementById("grid-h");
    const box = grid.getBoundingClientRect();
    if (heading && (box.top > innerHeight * 0.6 || box.bottom < 0)) heading.scrollIntoView({ behavior, block: "start" });
    const scroller = grid.parentElement;
    if (scroller) {
      const cell = first.getBoundingClientRect();
      const area = scroller.getBoundingClientRect();
      scroller.scrollBy({ left: cell.left + cell.width / 2 - (area.left + area.width / 2), behavior });
    }
  }

  return (
    // A button for the keyboard and screen readers, which hear whether it is pressed, but drawn as the
    // words it is, with a dotted underline that says something happens; solid while pressed.
    <button
      type="button"
      onClick={press}
      onMouseEnter={() => mark(key)}
      onMouseLeave={() => mark(pressedNow)}
      aria-pressed={pressed}
      aria-controls="judgement-grid"
      className={`cursor-pointer text-left font-medium text-ink underline decoration-1 underline-offset-4 hover:decoration-solid ${
        pressed ? "decoration-primary decoration-solid decoration-2" : "decoration-ink-muted decoration-dotted"
      }`}
    >
      {children}
      <span className="sr-only">: show in the grid of regulations</span>
    </button>
  );
}
