"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, type Theme } from "./theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  const media = matchMedia(DARK_QUERY);
  listeners.add(listener);
  media.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
  };
}

function shownTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function chooseTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // If storage is blocked, keep the theme until the page reloads.
  }
  listeners.forEach((listener) => listener());
}

// The theme the page is shown in: the one chosen with the toggle, or else the system's. null on the
// server and until hydration, which cannot know it.
export function useShownTheme(): Theme | null {
  return useSyncExternalStore(subscribe, shownTheme, () => null);
}

// "Dark mode", with a moon, and its state in words, as Easier to read beside it is (design-toggle.tsx).
// It was a moon alone, labelled only for screen readers; in user testing (P2_1, CCARE-258) the
// participant asked to turn on dark mode pressed Easier to read first, the one with words.
export function ThemeToggle() {
  // Unpressed and disabled, with no state in words, until the theme is known.
  const theme = useShownTheme();
  const dark = theme === "dark";
  const other: Theme = dark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => chooseTheme(other)}
      disabled={theme === null}
      aria-pressed={dark}
      className="flex h-11 shrink-0 items-center gap-2 rounded-md border border-line px-3 text-sm font-semibold text-ink-muted hover:text-ink"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <span>
        Dark mode
        {/* Screen readers hear the state from aria-pressed, so they don't need the words too. */}
        {theme && <span aria-hidden="true">: {dark ? "On" : "Off"}</span>}
      </span>
    </button>
  );
}
