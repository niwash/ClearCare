"use client";

import { useSyncExternalStore } from "react";
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
      {/* Half-filled circle: the usual contrast symbol. */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
      </svg>
      <span>
        Easier to read
        {/* Screen readers hear the state from aria-pressed, so they don't need the words too. */}
        {design && <span aria-hidden="true">: {on ? "On" : "Off"}</span>}
      </span>
    </button>
  );
}
