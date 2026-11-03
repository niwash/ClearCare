"use client";

// The search form's layout (CCARE-189): the fields most searches need in one row with Search, and
// the rest behind "More filters", as in the filter bars of listing sites. With only a few kinds of
// filter, a bar above the results is quicker to use than a sidebar (Baymard). The hidden fields are
// still in the form, so their values are kept. It opens by itself when one of them is set, so a
// search never hides what it was filtered by.
import { useState, type ReactNode } from "react";

export function FilterLayout({
  main,
  more,
  actions,
  moreSet,
}: {
  main: ReactNode;
  more: ReactNode;
  // Search, and "Clear filters" once there's something to clear.
  actions: ReactNode;
  // How many of the fields under "More filters" are filled in.
  moreSet: number;
}) {
  const [open, setOpen] = useState(moreSet > 0);

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        {main}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {actions}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="more-filters"
            className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink hover:border-primary adult:rounded-md"
          >
            {/* Sliders: the usual sign for filters. */}
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-4">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
            More filters{moreSet > 0 && ` (${moreSet})`}
          </button>
        </div>
      </div>
      <div id="more-filters" className={open ? "flex flex-col gap-4 border-t border-line-soft pt-4" : "hidden"}>
        {more}
      </div>
    </>
  );
}
