"use client";

import { useEffect } from "react";

// Cards and blocks of text slide up into place as they come into view (CCARE-186), on the home
// page, Resources, National Figures and the guides; globals.css has the motion. This marks the page
// with data-slide-up, which hides the blocks, and each block with data-shown as it comes into view.
// On the home page the blocks already on screen slide up too (slide-up-script.ts hides them before
// the first paint); elsewhere (slideOnOpen={false}) they simply show. Never in the adult-centred
// design or with reduced motion, and without JavaScript nothing is hidden.

function motionAllowed() {
  return (
    document.documentElement.dataset.design !== "adult-centred" &&
    "IntersectionObserver" in window &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const BLOCKS = ".reveal:not([data-shown]), .reveal-stagger > :not([data-shown])";

// Cards of a row that come into view together arrive this far apart, up to the fourth.
const STAGGER_SECONDS = 0.07;
const STAGGER_STEPS = 3;

// The observer's rootMargin: a block counts as in view a little above the bottom of the window,
// so it slides up where it can be seen.
const IN_VIEW_FROM_BOTTOM = 0.1;

export function SlideUp({ slideOnOpen = true }: { slideOnOpen?: boolean }) {
  useEffect(() => {
    const root = document.documentElement;
    if (!motionAllowed()) {
      delete root.dataset.slideUp;
      return;
    }
    // Before the page is marked, so these are never hidden and have nothing to slide from. Any part
    // of the window counts, even the strip at the bottom the observer leaves out, and so do blocks
    // above it, for a page opened part way down.
    if (!slideOnOpen) {
      document.querySelectorAll(BLOCKS).forEach((block) => {
        if (block.getBoundingClientRect().top < window.innerHeight) block.setAttribute("data-shown", "");
      });
    }
    // Also set here: the layout's script (slide-up-script.ts) only runs when the home page is
    // loaded, not when it is reached through a link on the site, and not on the other pages.
    root.dataset.slideUp = "";
    root.dataset.slideUpReady = "";

    const observer = new IntersectionObserver(
      (entries) => {
        // Counted per row, in page order, so the cards of a row (or of a grid's rows on screen
        // together) arrive one after another, however many columns the grid has at this width.
        // Stacked on phones, they mostly come into view one at a time anyway.
        const arrived = new Map<Element, number>();
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const block = entry.target as HTMLElement;
          const row = block.parentElement;
          if (row?.classList.contains("reveal-stagger")) {
            const step = arrived.get(row) ?? 0;
            arrived.set(row, step + 1);
            block.style.setProperty("--slide-delay", `${Math.min(step, STAGGER_STEPS) * STAGGER_SECONDS}s`);
          }
          block.setAttribute("data-shown", "");
          observer.unobserve(block);
        }
      },
      { rootMargin: `0px 0px -${IN_VIEW_FROM_BOTTOM * 100}% 0px` },
    );
    const watch = () => document.querySelectorAll(BLOCKS).forEach((block) => observer.observe(block));
    watch();
    // The home page's example home streams in after the rest of the page.
    const arrivals = new MutationObserver(watch);
    arrivals.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      arrivals.disconnect();
      delete root.dataset.slideUp;
      delete root.dataset.slideUpReady;
    };
  }, [slideOnOpen]);

  return null;
}
