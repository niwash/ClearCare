"use client";

import { useEffect, useRef } from "react";

// A figure that counts up from 0 as it scrolls into view (CCARE-186), under the same conditions as
// the slide-up (slide-up.tsx). Screen readers and print get the real figure; an invisible copy of
// it holds the width, so the words around it don't shift as the digits grow.

// The same format as formatCount (lib/statistics.ts), which isn't imported to keep the API code out
// of the browser.
const COUNT = new Intl.NumberFormat("en-IE");
const DURATION = 1600;

export function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const counter = useRef<HTMLSpanElement>(null);
  const text = `${COUNT.format(to)}${suffix}`;

  useEffect(() => {
    const element = counter.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionOff = () => document.documentElement.dataset.design === "adult-centred" || reduced.matches;
    if (motionOff() || !("IntersectionObserver" in window)) return;
    // Hidden or already on screen: left as it is. A hidden figure would never scroll into view, and
    // would stay at 0 if the window then widened.
    const box = element.getBoundingClientRect();
    if (element.getClientRects().length === 0 || (box.top < window.innerHeight && box.bottom > 0)) return;

    // Written straight to the element rather than through state: 60 renders a second for a
    // decoration would be wasted work.
    element.textContent = `0${suffix}`;
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min((now - start) / DURATION, 1);
          // Ease out: quick at first, settling on the real figure.
          const eased = 1 - (1 - progress) ** 3;
          element.textContent = progress < 1 ? `${COUNT.format(Math.round(to * eased))}${suffix}` : text;
          if (progress < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    observer.observe(element);

    // Easier to read, or less motion, chosen after the page opened: the real figure at once.
    const stop = () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      element.textContent = text;
    };
    const settingChanged = () => {
      if (motionOff()) stop();
    };
    const design = new MutationObserver(settingChanged);
    design.observe(document.documentElement, { attributes: true, attributeFilter: ["data-design"] });
    reduced.addEventListener("change", settingChanged);
    return () => {
      design.disconnect();
      reduced.removeEventListener("change", settingChanged);
      stop();
    };
  }, [to, suffix, text]);

  return (
    <span className="inline-grid tabular-nums">
      {/* Print swaps the two (globals.css), so a page printed before the figures scrolled into view
          shows the real ones, not 0. */}
      <span ref={counter} aria-hidden className="count-up-live col-start-1 row-start-1">
        {text}
      </span>
      <span aria-hidden className="count-up-sizer invisible col-start-1 row-start-1">
        {text}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
