"use client";

// components/ui/show-less.tsx
// A "Show less" button at the bottom of an open <details>, so a long section can be closed from
// where the reader finished rather than only from its top (CCARE-212). It closes the <details> it
// is in, then brings the section's summary back into view if it has scrolled off the top, so the
// reader isn't left further down the page than the closed section.
import type { MouseEvent } from "react";

export function ShowLess({ className = "" }: { className?: string }) {
  const close = (event: MouseEvent<HTMLButtonElement>) => {
    const details = event.currentTarget.closest("details");
    if (!details) return;
    details.open = false;
    const summary = details.querySelector("summary");
    if (summary && summary.getBoundingClientRect().top < 0) summary.scrollIntoView({ block: "start" });
    summary?.focus();
  };
  return (
    <button type="button" onClick={close} className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover ${className}`}>
      Show less
      <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 15l6-6 6 6" />
      </svg>
    </button>
  );
}
