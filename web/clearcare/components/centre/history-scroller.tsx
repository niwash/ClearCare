// components/centre/history-scroller.tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// The scroll box of the judgment grid (judgement-grid.tsx). Where the grid is wider than the screen
// it scrolls sideways inside this box, so the page never does. It opens at the right-hand end, where
// the newest inspections are, and while it scrolls it can be focused, so the keyboard's arrow keys
// scroll it too (WCAG 2.1.1).
export function HistoryScroller({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Whether it scrolls depends on the screen's width, so it is measured, and again when that changes.
  const [scrolls, setScrolls] = useState(false);

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    box.scrollLeft = box.scrollWidth;
    const observer = new ResizeObserver(() => setScrolls(box.scrollWidth > box.clientWidth));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  return (
    // relative: keeps the sr-only text inside this scroll box so it can't widen the page. The box
    // cuts off what reaches past it, so it has room on the right and below for the focus outline of
    // a cell that links. scroll-pl: the titles' column covers that much of the left (9.75rem while
    // the grid scrolls), and a cell the keyboard reaches has to come to rest clear of it (WCAG 2.4.11).
    <div
      ref={ref}
      {...(scrolls && { tabIndex: 0, role: "region", "aria-label": "Judgments for each regulation, scrolls sideways" })}
      className="relative mt-3 scroll-pl-40 overflow-x-auto pr-1.5 pb-1.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink print:overflow-visible"
    >
      {children}
    </div>
  );
}
