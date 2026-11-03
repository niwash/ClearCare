"use client";

// The search form's wrapper on phones (CCARE-189). Once there are results, the form folds into one
// line saying what was searched, with a button to change it, so the results start on the first
// screen, as on most listing sites. From md up the form is always open.
import { useState, type ReactNode } from "react";

export function SearchPanel({ summary, children }: { summary: string | null; children: ReactNode }) {
  // Folded once something has been searched for; never before, as there's no line to open it from.
  const [folded, setFolded] = useState(true);
  const open = summary === null || !folded;

  return (
    <div className="flex flex-col gap-3">
      {summary !== null && (
        <button
          type="button"
          onClick={() => setFolded(!folded)}
          aria-expanded={open}
          aria-controls="search-panel"
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-2 text-left shadow-sm md:hidden adult:rounded-lg adult:shadow-none"
        >
          <span className="min-w-0">
            <span className="block text-sm text-ink-muted">Searching for</span>
            <span className="block truncate font-semibold text-ink">{summary}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-primary">
            {open ? "Close" : "Change search"} <span aria-hidden>{open ? "▴" : "▾"}</span>
          </span>
        </button>
      )}
      <div id="search-panel" className={open ? "" : "hidden md:block"}>
        {children}
      </div>
    </div>
  );
}
