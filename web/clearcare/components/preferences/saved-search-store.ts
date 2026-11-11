"use client";

// components/preferences/saved-search-store.ts
// The saved search, shared by the button in the filters panel and the page itself (ADR-0025).
//
// The page reads the account's saved search on the server and hands the answer down, so the browser
// asks the API nothing on arrival: a signed-out visitor sends no request at all, and a signed-in one
// sends none either, because the server already knows what is stored. Saving and forgetting do call
// the API, and move every consumer at once.
//
// It is a store rather than state in one component because the panel is mounted twice — the filters
// column and the phone's sheet — and both show the same button. The shortlist keeps its state the
// same way (components/compare/compare-store.ts).
import { useSyncExternalStore } from "react";

import { parseSavedSearch, savedSearchDocument, type SavedSearch } from "@/lib/preferences";

// Signed out and unconfigured both mean "offer nothing"; the page says which one it found.
export type SavedSearchStatus = "signed_out" | "unavailable" | "ready";

export interface SavedSearchInitial {
  status: SavedSearchStatus;
  saved: SavedSearch | null;
}

export interface SavedSearchState extends SavedSearchInitial {
  // What to tell the visitor when the last save or forget did not work.
  error: string;
  busy: boolean;
}

const START: SavedSearchState = {
  status: "signed_out",
  saved: null,
  error: "",
  busy: false,
};

let state: SavedSearchState = START;
const listeners = new Set<() => void>();
// Fires when a save has been stored: the confirmation that outlives the sheet on a phone.
const savedListeners = new Set<() => void>();

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

// The current state. The browser cannot know it before the page hands it over, so it renders as a
// visitor with nothing stored.
export function useSavedSearch(): SavedSearchState {
  return useSyncExternalStore(subscribe, () => state, () => START);
}

// What the page read on the server: the answer to "does this account keep a search?", with no round
// trip from the browser.
export function hydrateSavedSearch(initial: SavedSearchInitial) {
  change({ status: initial.status, saved: initial.saved, error: "", busy: false });
}

// Calls back when a save is stored. The sheet closes on a phone as the save is applied, so the
// confirmation cannot live in the button there.
export function onSavedPreferences(listener: () => void) {
  savedListeners.add(listener);
  return () => {
    savedListeners.delete(listener);
  };
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
    savedListeners.forEach((listener) => listener());
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
