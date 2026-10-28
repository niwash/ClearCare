"use client";

// The homes saved to compare (CCARE-127), in localStorage so they survive a reload, shared by every
// compare button and the navigation link. Another tab's change shows up here too.
import { useSyncExternalStore } from "react";
import { addHome, COMPARE_STORAGE_KEY, parseCompared, removeHome, type ComparedHome } from "@/lib/compare";

const listeners = new Set<() => void>();
// Used when storage is blocked, so the list still works until the page reloads.
let memory: string | null = null;
// The last list read, kept while the stored text is the same: useSyncExternalStore needs the same
// object back each time nothing has changed.
let cachedRaw: string | null | undefined;
let cached: ComparedHome[] = [];

function read() {
  try {
    return localStorage.getItem(COMPARE_STORAGE_KEY);
  } catch {
    return memory;
  }
}

function snapshot() {
  const raw = read();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseCompared(raw);
  }
  return cached;
}

function subscribe(listener: () => void) {
  // "storage" fires when another tab changes the list; key is null when storage is cleared.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === COMPARE_STORAGE_KEY) listener();
  };
  listeners.add(listener);
  addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    removeEventListener("storage", onStorage);
  };
}

function write(homes: ComparedHome[]) {
  const raw = JSON.stringify(homes);
  memory = raw;
  try {
    localStorage.setItem(COMPARE_STORAGE_KEY, raw);
  } catch {
    // Storage is blocked or full: the list lives in memory until the page reloads.
  }
  listeners.forEach((listener) => listener());
}

// The saved homes, or null until hydration, as the server can't know them.
export function useComparedHomes() {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

export function addToCompare(home: ComparedHome) {
  write(addHome(snapshot(), home));
}

export function removeFromCompare(id: string) {
  write(removeHome(snapshot(), id));
}

export function replaceCompared(homes: ComparedHome[]) {
  write(parseCompared(JSON.stringify(homes)));
}

export function clearCompared() {
  write([]);
}
