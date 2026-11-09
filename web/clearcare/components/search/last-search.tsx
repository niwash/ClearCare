"use client";

// components/search/last-search.tsx
// The visitor's last search on this visit (CCARE-214), so the links to search (the navigation's
// "Search for Homes", and "Search for other homes" on Compare Homes) go back to the same filters
// rather than an empty search. Kept in sessionStorage: it lasts for the tab's visit and is never
// sent anywhere. The search page records it (RememberSearch); the links read it (LastSearchLink).
//
// Only clearing the search forgets it: "Clear all", which lands on ?filtersCleared=true, and
// "Forget my preferences" (forgetLastSearch). Arriving at /search with nothing in the address, from
// a link that doesn't carry the search, leaves it as it was.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

const LAST_SEARCH_KEY = "last-search";
const SEARCH_PATH = "/search";
// The address the search page goes to when every field is cleared (filtersClearedHref, lib/search.ts).
const CLEARED_PARAM = "filtersCleared";

// The links stay on screen across pages (the header and footer are kept between them), so they
// listen for the search changing rather than reading it once.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function write(query: string | null) {
  try {
    if (query) sessionStorage.setItem(LAST_SEARCH_KEY, query);
    else sessionStorage.removeItem(LAST_SEARCH_KEY);
  } catch {
    // Storage is blocked: the links go to an empty search, as before.
  }
  listeners.forEach((listener) => listener());
}

// For "Forget my preferences", which empties the search without going through ?filtersCleared:
// SavePreferencesButton calls its onForgotten once forgetPreferences() succeeds, and SearchFilters
// passes startOver, which calls this.
export function forgetLastSearch() {
  write(null);
}

// The search worth going back to: without its page number, so a return starts at the first page of
// results, and without empty fields. Pressing Search on the home page with nothing typed lands on
// ?name=, which the search page answers with "Please enter something to search for"; remembered,
// it sent every link to search there too. A search with nothing left is not noted, and the last
// real one stays.
function worthKeeping(query: string): string {
  const params = new URLSearchParams(query);
  params.delete("page");
  for (const [key, value] of [...params]) if (!value.trim()) params.delete(key);
  return params.toString();
}

// On the search page: notes the search each time it changes, and forgets it when it is cleared.
export function RememberSearch() {
  const params = useSearchParams();
  const query = params.toString();
  useEffect(() => {
    if (new URLSearchParams(query).has(CLEARED_PARAM)) write(null);
    else {
      const kept = worthKeeping(query);
      if (kept) write(kept);
    }
  }, [query]);
  return null;
}

function readLastSearch(): string {
  try {
    const query = sessionStorage.getItem(LAST_SEARCH_KEY);
    return query ? `${SEARCH_PATH}?${query}` : SEARCH_PATH;
  } catch {
    return SEARCH_PATH;
  }
}

// A link to the last search, or to an empty search when there is none. The server can't know it, so
// the page is sent with the empty search and the link is updated once the page is in the browser.
export function LastSearchLink({ className, children }: { className: string; children: ReactNode }) {
  const href = useSyncExternalStore(subscribe, readLastSearch, () => SEARCH_PATH);
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
