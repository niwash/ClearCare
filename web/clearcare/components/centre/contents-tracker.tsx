"use client";

// components/centre/contents-tracker.tsx
// What the centre page's bar of section links needs from the browser. It marks where the reader
// is: the section whose top has passed just under the bar, and within "What happened next" the
// trail, with aria-current="location" (the bar styles it), and keeps that link in view when the
// bar scrolls sideways on a phone. And it opens and closes the list of trails: by its arrow, and
// it closes on Escape, a click elsewhere, or a choice from it. The links work without this; it
// only adds to them. Rechecked on scroll, resize, and when a trail opens or closes, which moves
// what's below.
import { useEffect } from "react";

// How far under the bar a section's top must pass to count as the one being read, in pixels.
const READING_GAP = 24;

export function ContentsTracker({ navId }: { navId: string }) {
  useEffect(() => {
    const nav = document.getElementById(navId);
    const scroller = nav?.querySelector<HTMLElement>("[data-contents-scroller]");
    const button = nav?.querySelector<HTMLButtonElement>("[data-contents-toggle]");
    if (!nav || !scroller) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const entries = [...nav.querySelectorAll<HTMLAnchorElement>("a[data-level]")].map((link) => ({
      link,
      level: link.dataset.level,
      target: document.getElementById(decodeURIComponent(link.hash.slice(1))),
    }));
    const sections = entries.filter((entry) => entry.level === "1" && entry.target);
    const trails = entries.filter((entry) => entry.level === "2");
    // The section the trails belong to: the one with the arrow.
    const trailSection = sections.find((entry) => entry.link.parentElement?.contains(button ?? null));

    let current: (typeof entries)[number] | undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = nav.getBoundingClientRect().bottom + READING_GAP;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const passed = (entry: (typeof entries)[number]) => entry.target && entry.target.getBoundingClientRect().top <= line;

      // The last section that has passed the line, the first before any has, the last at the very
      // bottom (a short final section may never reach the line).
      const section = atBottom ? sections.at(-1) : (sections.findLast(passed) ?? sections[0]);
      const trail = section && section === trailSection ? trails.findLast(passed) : undefined;
      for (const entry of entries) {
        if (entry === section || entry === trail) entry.link.setAttribute("aria-current", "location");
        else entry.link.removeAttribute("aria-current");
      }

      // On a phone, bring the section's link into the bar's view when it changes: smoothly, except
      // in the adult-centred design or with reduced motion, where it jumps.
      if (section && section !== current) {
        const { offsetLeft, offsetWidth } = section.link;
        if (offsetLeft < scroller.scrollLeft || offsetLeft + offsetWidth > scroller.scrollLeft + scroller.clientWidth) {
          const smooth = document.documentElement.dataset.design !== "adult-centred" && !reducedMotion.matches;
          scroller.scrollTo({ left: offsetLeft - 16, behavior: smooth ? "smooth" : "auto" });
        }
      }
      current = section;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const setOpen = (open: boolean) => {
      nav.dataset.open = String(open);
      button?.setAttribute("aria-expanded", String(open));
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-contents-toggle]")) setOpen(nav.dataset.open !== "true");
      else if (target?.closest('a[data-level="2"]') || !nav.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || nav.dataset.open !== "true") return;
      setOpen(false);
      button?.focus();
    };

    update();
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // "toggle" doesn't bubble, so it's caught on the way down.
    document.addEventListener("toggle", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("toggle", schedule, true);
    };
  }, [navId]);

  return null;
}
