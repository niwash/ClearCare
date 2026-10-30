"use client";

import { useEffect, useRef } from "react";

// A figure that counts up from 0 as it scrolls into view (CCARE-186), like the yearly figures on
// sageadvocacy.ie. The server renders the real figure, so it shows without JavaScript, and screen
// readers only ever hear the real figure: the counting copy is hidden from them. An invisible copy
// of the real figure holds the width, so the words around it don't shift as the digits grow.
//
// Like the sections' rise-in (globals.css), it never runs in the adult-centred design or for people
// who have asked their device for less motion, and a figure that is hidden or already on screen when
// the page loads is left as it is rather than dropped to 0.

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
    if (
      document.documentElement.dataset.design === "adult-centred" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }
    // Hidden (the news banner's figure on phones) or already on screen: left as it is. A hidden
    // figure would never scroll into view, and would stay at 0 if the window then widened.
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
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      element.textContent = text;
    };
  }, [to, suffix, text]);

  return (
    <span className="inline-grid tabular-nums">
      <span ref={counter} aria-hidden className="col-start-1 row-start-1">
        {text}
      </span>
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {text}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
