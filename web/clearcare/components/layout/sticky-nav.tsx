"use client";

// components/layout/sticky-nav.tsx
// The navigation band, kept at the top of the window as the page scrolls (CCARE-296), so the menu
// and the bar under the page being shown are always in view. It measures itself and sets
// --header-offset on the page's root to its height, so everything else that sticks to the top (a
// guide's side panel, Compare's bar of names, search's filter row) sits under it rather than behind
// it, and a jump to an anchor stops below it (scroll-padding-top, globals.css). While the band is
// hidden (phones and tablets in the standard design, where the Menu button carries the navigation)
// the offset is 0.
import { useEffect, useRef, type ReactNode } from "react";

export function StickyNav({ className, children }: { className: string; children: ReactNode }) {
  const band = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = band.current;
    if (!element) return;
    const root = document.documentElement;
    const update = () => {
      // Hidden by its classes: no box, so nothing to clear.
      const height = getComputedStyle(element).display === "none" ? 0 : element.offsetHeight;
      root.style.setProperty("--header-offset", `${height}px`);
    };
    update();
    // Its height changes with the window's width, the design, and the text size.
    const observer = new ResizeObserver(update);
    observer.observe(element);
    addEventListener("resize", update);
    return () => {
      observer.disconnect();
      removeEventListener("resize", update);
      root.style.removeProperty("--header-offset");
    };
  }, []);

  return (
    <div ref={band} className={`sticky top-0 z-30 ${className}`}>
      {children}
    </div>
  );
}
