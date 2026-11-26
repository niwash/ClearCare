"use client";

import { useSyncExternalStore } from "react";
import { DESIGN_STORAGE_KEY, type Design } from "./theme";
import { AccessibilityIcon } from "./accessibility-icon";
import { ToggleState, toggleButtonClass } from "./toggle-state";

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
      className={toggleButtonClass}
    >
      {/* The accessibility figure (CCARE-318), then the words. The state shows in the words,
          ": On" or ": Off". */}
      <AccessibilityIcon />
      <span>
        Easier to read
        <ToggleState on={design === null ? null : on} />
      </span>
    </button>
  );
}
