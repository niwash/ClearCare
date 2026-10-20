// components/centre/history-scroller.tsx
"use client";

import { useEffect, useRef, type ReactNode } from "react";

// The inspection history table's scroll box. When it scrolls sideways it opens at the right-hand
// end, where the newest inspections are, and it can be focused so the keyboard's arrow keys
// scroll it too (WCAG 2.1.1).
export function HistoryScroller({ scrolls, children }: { scrolls: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrolls && ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, [scrolls]);

  return (
    // relative: keeps the sr-only text inside this scroll box so it can't widen the page.
    <div
      ref={ref}
      {...(scrolls && { tabIndex: 0, role: "region", "aria-label": "Inspection history table, scrolls sideways" })}
      className="relative hidden overflow-x-auto border-t border-line-soft focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ink lg:block"
    >
      {children}
    </div>
  );
}
