"use client";

// components/preferences/saved-search-store.ts
// The saved search, shared by the button in the filters panel and the page's own auto-apply
// (ADR-0025). One read per page load, whoever asks first, and a save or a forget moves every
// consumer at once.
//
// It is a store rather than state in one component because the panel is mounted twice — the
// filters column and the phone's sheet — and both show the same button. The shortlist keeps its
// state the same way (components/compare/compare-store.ts).
import { useSyncExternalStore } from "react";

import { parseSavedSearch, savedSearchDocument, type SavedSearch } from "@/lib/preferences";

export interface SavedSearchState {
  status: "loading" | "ready" | "unavailable";
  saved: SavedSearch | null;
  // What to tell the visitor when the last save or forget did not work.
  error: string;
  busy: boolean;
}

// Signed out, or the deployment has no saved searches: both ask the visitor nothing and render
// nothing, so they are one state here.
const START: SavedSearchState = {
  status: "loading",
  saved: null,
  error: "",
  busy: false,
};

let state: SavedSearchState = START;
let asked = false;
const listeners = new Set<() => void>();

function change(next: Partial<SavedSearchState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The current state. The server cannot know it, so it renders as if nothing is saved.
export function useSavedSearch(): SavedSearchState {
  return useSyncExternalStore(subscribe, () => state, () => START);
}

// Reads the account's saved search, once however many components ask.
export function loadSavedSearch() {
  if (asked) return;
  asked = true;

  fetch("/api/preferences", { cache: "no-store" })
    .then(async (response): Promise<Partial<SavedSearchState>> => {
      if (!response.ok) return { status: "unavailable" };
      const body = (await response.json()) as { saved?: unknown };
      return { status: "ready", saved: parseSavedSearch(body.saved) };
    })
    .catch((): Partial<SavedSearchState> => ({ status: "unavailable" }))
    .then(change);
}

// Keeps these choices against the account, and calls `then` once they are stored — the panel uses
// it to apply what it has just saved, so the results on screen are the ones kept.
export async function savePreferences(saved: SavedSearch, then?: () => void): Promise<boolean> {
  change({ busy: true, error: "" });

  try {
    const response = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(savedSearchDocument(saved)),
    });
    if (!response.ok) {
      change({ busy: false, error: "Your preferences couldn't be saved just now. Please try again." });
      return false;
    }
    const body = (await response.json()) as { saved?: unknown };
    change({ busy: false, status: "ready", saved: parseSavedSearch(body.saved) ?? saved });
    then?.();
    return true;
  } catch {
    change({ busy: false, error: "Your preferences couldn't be saved just now. Please try again." });
    return false;
  }
}

export async function forgetPreferences(): Promise<boolean> {
  change({ busy: true, error: "" });

  try {
    const response = await fetch("/api/preferences", { method: "DELETE" });
    if (!response.ok) {
      change({ busy: false, error: "Your preferences couldn't be removed just now. Please try again." });
      return false;
    }
    change({ busy: false, status: "ready", saved: null });
    return true;
  } catch {
    change({ busy: false, error: "Your preferences couldn't be removed just now. Please try again." });
    return false;
  }
}
