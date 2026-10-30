"use client";

import { useEffect } from "react";

// The home page's cards and blocks of text slide up into place as they come into view (CCARE-186),
// replacing CCARE-179's rise-in, which followed the scroll position: that was subtle, and missing in
// browsers that can't tie an animation to scrolling. globals.css has the motion; this marks the page
// with data-slide-up, which hides the blocks (.reveal, and each card in a .reveal-stagger row), and
// each block with data-shown as it scrolls into view. Blocks on screen when the page opens slide up
// straight away.
//
// Like the rest of the site's motion it never runs in the adult-centred design or for people who
// have asked their device for less motion, and without JavaScript nothing is hidden.

function motionAllowed() {
  return (
    document.documentElement.dataset.design !== "adult-centred" &&
    "IntersectionObserver" in window &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const BLOCKS = ".reveal:not([data-shown]), .reveal-stagger > :not([data-shown])";

export function SlideUp() {
  useEffect(() => {
    const root = document.documentElement;
    if (!motionAllowed()) {
      delete root.dataset.slideUp;
      return;
    }
    // Also set here: the layout's script (slide-up-script.ts) only runs when the page is loaded, not
    // when it is reached through a link on the site.
    root.dataset.slideUp = "";
    root.dataset.slideUpReady = "";

    // A little above the bottom of the window, so a block slides up where it can be seen.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-shown", "");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    const watch = () => document.querySelectorAll(BLOCKS).forEach((block) => observer.observe(block));
    watch();
    // The example home streams in after the rest of the page.
    const arrivals = new MutationObserver(watch);
    arrivals.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      arrivals.disconnect();
      delete root.dataset.slideUp;
      delete root.dataset.slideUpReady;
    };
  }, []);

  return null;
}
