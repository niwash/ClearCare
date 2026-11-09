"use client";

import { useId, useSyncExternalStore } from "react";
import { DESIGN_STORAGE_KEY, type Design } from "./theme";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function shownDesign(): Design {
  return document.documentElement.dataset.design === "adult-centred" ? "adult-centred" : "standard";
}

function chooseDesign(design: Design) {
  if (design === "adult-centred") document.documentElement.dataset.design = design;
  else delete document.documentElement.dataset.design;
  try {
    localStorage.setItem(DESIGN_STORAGE_KEY, design);
  } catch {
    // If storage is blocked, keep the design until the page reloads.
  }
  listeners.forEach((listener) => listener());
}

// Turns the adult-centred design on and off. A labelled button rather than an icon,
// so its purpose doesn't have to be guessed.
export function DesignToggle() {
  // The server cannot know the design, so the button renders unpressed and disabled until hydration.
  const design = useSyncExternalStore(subscribe, shownDesign, () => null);
  const on = design === "adult-centred";
  // The switch's mask needs an ID of its own on the page. Letters and digits only: React's IDs hold
  // characters that would break the url(#…) the mask is referred to by.
  const knobMask = `design-knob-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <button
      type="button"
      onClick={() => chooseDesign(on ? "standard" : "adult-centred")}
      disabled={design === null}
      aria-pressed={on}
      className={`flex h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
        on ? "border-primary bg-primary text-on-primary hover:bg-primary-hover" : "border-line text-ink-muted hover:text-ink"
      }`}
    >
      {/* A switch that shows the state by shape, not only colour or the words (CCARE-214): off is
          an outlined track with the knob on the left; on is a filled track with the knob on the
          right, cut out of it so it shows the button's own background in every theme and design.
          It replaced a half-filled circle, which looked like the "Substantially compliant" mark. */}
      <svg width="28" height="16" viewBox="0 0 28 16" aria-hidden="true" className="shrink-0">
        {on ? (
          <>
            <mask id={knobMask}>
              <rect width="28" height="16" fill="white" />
              <circle cx="20" cy="8" r="4.5" fill="black" />
            </mask>
            <rect x="1" y="1" width="26" height="14" rx="7" fill="currentColor" mask={`url(#${knobMask})`} />
          </>
        ) : (
          <>
            <rect x="1" y="1" width="26" height="14" rx="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="8" cy="8" r="4" fill="currentColor" />
          </>
        )}
      </svg>
      <span>
        Easier to read
        {/* Screen readers hear the state from aria-pressed, so they don't need the words too. */}
        {design && <span aria-hidden="true">: {on ? "On" : "Off"}</span>}
      </span>
    </button>
  );
}
