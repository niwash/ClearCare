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

export function ThemeToggle() {
  // The server cannot know the theme, so the button renders empty until hydration.
  const theme = useSyncExternalStore(subscribe, shownTheme, () => null);
  const other: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => chooseTheme(other)}
      disabled={theme === null}
      aria-label={`Switch to ${other} theme`}
      title={`Switch to ${other} theme`}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-ink-muted hover:text-ink"
    >
      {theme && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          {theme === "dark" ? (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </>
          ) : (
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          )}
        </svg>
      )}
    </button>
  );
}
