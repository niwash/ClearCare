"use client";

import { useSyncExternalStore } from "react";
import { DESIGN_STORAGE_KEY, type Design } from "./theme";
import { ToggleState } from "./toggle-state";

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
      className={`flex h-11 shrink-0 items-center rounded-md border px-3 text-sm font-semibold ${
        on ? "border-primary bg-primary text-on-primary hover:bg-primary-hover" : "border-line text-ink-muted hover:text-ink"
      }`}
    >
      {/* Words only: the switch drawing that was here (CCARE-214) is gone (CCARE-258). The state is
          still shown other than by colour: in the words, ": On" or ": Off", and by the filled button
          when it's on. */}
      <span>
        Easier to read
        <ToggleState on={design === null ? null : on} />
      </span>
    </button>
  );
}
