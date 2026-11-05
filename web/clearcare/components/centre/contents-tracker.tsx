"use client";

// components/centre/contents-tracker.tsx
// What the centre page's contents sidebar needs from the browser. It marks where the reader is:
// the section whose top has passed a line near the top of the window, and within "What happened
// next" the trail, with aria-current="location" (the sidebar styles it). And it opens a section's
// own entries while the reader is in that section; the arrow beside it opens or closes them by
// hand, until the reader moves into or out of the section. The links work without this; it only
// adds to them. Rechecked on scroll, resize, and when a trail opens or closes, which moves what's
// below.
import { useEffect } from "react";

// How far down the window a section's top must pass to count as the one being read.
const READING_LINE = 0.25;

export function ContentsTracker({ navId }: { navId: string }) {
  useEffect(() => {
    const nav = document.getElementById(navId);
    if (!nav) return;
    const entries = [...nav.querySelectorAll<HTMLAnchorElement>("a[data-level]")].map((link) => ({
      link,
      level: link.dataset.level,
      item: link.closest("li")!,
      target: document.getElementById(decodeURIComponent(link.hash.slice(1))),
    }));
    const sections = entries.filter((entry) => entry.level === "1" && entry.target);

    // A section opened or closed by hand, and whether the reader was in it at the time.
    const chosen = new Map<HTMLLIElement, { open: boolean; wasCurrent: boolean }>();
    let current: (typeof entries)[number] | undefined;

    const setOpen = (item: HTMLLIElement, open: boolean) => {
      item.dataset.open = String(open);
      item.querySelector("[data-contents-toggle]")?.setAttribute("aria-expanded", String(open));
    };

    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * READING_LINE;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const passed = (entry: (typeof entries)[number]) => entry.target && entry.target.getBoundingClientRect().top <= line;

      // The last section that has passed the line, the first before any has, the last at the very
      // bottom (a short final section may never reach the line).
      current = atBottom ? sections.at(-1) : (sections.findLast(passed) ?? sections[0]);
      // A trail only counts inside its own section.
      const child = entries.filter((entry) => entry.level === "2" && entry.item.parentElement?.closest("li") === current?.item).findLast(passed);

      for (const entry of entries) {
        if (entry === current || entry === child) entry.link.setAttribute("aria-current", "location");
        else entry.link.removeAttribute("aria-current");
      }
      for (const section of sections) {
        if (!section.item.querySelector("[data-contents-toggle]")) continue;
        const isCurrent = section === current;
        const choice = chosen.get(section.item);
        // A choice by hand lasts until the reader moves into or out of the section.
        if (choice && choice.wasCurrent !== isCurrent) chosen.delete(section.item);
        setOpen(section.item, chosen.get(section.item)?.open ?? isCurrent);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const toggle = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest("[data-contents-toggle]") : null;
      const item = button?.closest("li");
      if (!item) return;
      chosen.set(item, { open: item.dataset.open !== "true", wasCurrent: current?.item === item });
      update();
    };

    update();
    nav.addEventListener("click", toggle);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // "toggle" doesn't bubble, so it's caught on the way down.
    document.addEventListener("toggle", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      nav.removeEventListener("click", toggle);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("toggle", schedule, true);
    };
  }, [navId]);

  return null;
}
