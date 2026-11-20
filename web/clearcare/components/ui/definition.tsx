"use client";

// components/ui/definition.tsx
// A word with its meaning a hover, focus or tap away (CCARE-278): the word is underlined with dots, as
// the amenity tags are, and a small box with the meaning opens under it. In user testing (P2_3,
// P2_4) participants didn't know what terms such as "Premises" meant, and P2_3 asked for "an overview
// popping up when hovering over something".
//
// The box is put on the page's top layer, at the word's place in the window, rather than inside the
// word's parent: the inspection grid scrolls sideways, and a box inside it would be cut off by its
// edges. So it closes when the page or the grid scrolls. Once drawn it is measured, and opens above
// the word when it doesn't fit under it and there's more room above: a long meaning in Easier to read
// is taller than a guess would allow, and near the bottom of a phone screen its last lines were cut
// off (PR #220 review).
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Where the word is in the window, and the box's width and left edge, fixed when it opens.
type Place = { word: DOMRect; left: number; width: number };

// The box's width, how far it keeps from the window's edges, and the gap between it and the word.
const WIDTH = 320;
const EDGE = 12;
const GAP = 6;

export function Definition({
  children,
  title,
  meaning,
  source,
  className = "",
}: {
  // The word, as shown.
  children: ReactNode;
  // The box's heading: the word in full, as a clamped title may be cut short.
  title: string;
  meaning: ReactNode;
  // Where the meaning's words come from, in small print under them.
  source?: ReactNode;
  className?: string;
}) {
  const [place, setPlace] = useState<Place | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const boxId = useId();

  function open() {
    const word = button.current?.getBoundingClientRect();
    if (!word) return;
    const width = Math.min(WIDTH, window.innerWidth - EDGE * 2);
    const left = Math.min(Math.max(word.left, EDGE), window.innerWidth - width - EDGE);
    setPlace({ word, left, width });
  }

  // Before it's painted: under the word if it fits there, otherwise on the side with more room, kept
  // inside the window. It's drawn hidden until then, so it never shows in the wrong place.
  useLayoutEffect(() => {
    const el = box.current;
    if (!place || !el) return;
    const { word } = place;
    const below = window.innerHeight - word.bottom - GAP - EDGE;
    const above = word.top - GAP - EDGE;
    const under = el.offsetHeight <= below || below >= above;
    el.style.top = under ? `${word.bottom + GAP}px` : "";
    el.style.bottom = under ? "" : `${window.innerHeight - word.top + GAP}px`;
    el.style.maxHeight = `${Math.max(under ? below : above, 0)}px`;
    el.style.visibility = "visible";
  }, [place]);

  // Closed by scrolling anything (it would no longer be under its word), by a tap elsewhere (phones
  // don't move focus on a tap) and by Escape.
  useEffect(() => {
    if (!place) return;
    const close = () => setPlace(null);
    const closeOutside = (event: PointerEvent) => {
      if (!button.current?.contains(event.target as Node)) setPlace(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlace(null);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [place]);

  return (
    <>
      {/* Opens rather than toggles on click: a tap also fires mouseenter first. A screen reader hears
          the meaning as the word's description once it's open. */}
      <button
        ref={button}
        type="button"
        aria-expanded={place !== null}
        aria-describedby={place ? boxId : undefined}
        onMouseEnter={open}
        onMouseLeave={() => setPlace(null)}
        onFocus={open}
        onBlur={() => setPlace(null)}
        onClick={open}
        className={`cursor-help text-left underline decoration-dotted decoration-1 underline-offset-4 outline-offset-2 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-ink aria-expanded:decoration-solid print:no-underline ${className}`}
      >
        {children}
      </button>
      {place &&
        createPortal(
          <div
            ref={box}
            id={boxId}
            role="tooltip"
            style={{ left: place.left, width: place.width, visibility: "hidden" }}
            className="pointer-events-none fixed z-50 flex overflow-hidden flex-col gap-1 rounded-xl border border-line bg-surface p-3 text-sm text-ink shadow-lg adult:rounded-md print:hidden"
          >
            <span className="font-semibold">{title}</span>
            <span className="text-ink-muted">{meaning}</span>
            {source && <span className="mt-1 text-xs text-ink-muted">{source}</span>}
          </div>,
          document.body,
        )}
    </>
  );
}
