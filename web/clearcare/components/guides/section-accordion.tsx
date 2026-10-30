"use client";

// components/guides/section-accordion.tsx
// What a guide whose sections are one-at-a-time <details> needs from the browser: a link to a
// section opens it, and a section opened by its header stays in view when the one above it closes.
// The sections themselves are server-rendered and work without this; it only adds to them.
import { useEffect } from "react";

// The guide's sections share a name, which is what makes them one at a time. Worked examples and
// other <details> inside them have none, so they're left alone.
function isSection(element: Element | null): element is HTMLDetailsElement {
  return element instanceof HTMLDetailsElement && element.name !== "";
}

// Opens the section a link points at (such as /guides/fair-deal#how-much-will-you-pay, from a centre
// page), on arrival and whenever the address's # changes, then brings it into view. The ids are plain
// ASCII, so the # is used as it is: decoding a broken escape such as "#%" throws.
function openFromHash() {
  const id = window.location.hash.slice(1);
  if (!id) return;
  const section = document.getElementById(id)?.closest("details");
  if (!section || section.open) return;
  section.open = true;
  section.scrollIntoView();
}

// Opening a section closes the open one (they share a name). When that one is above, the page
// shrinks over it and can carry the new section's header off the top of the window, so it's
// brought back. Only for a click on the header (Enter and Space click it too): when find in page
// opens a section, the browser has already scrolled to the match.
function keepInView(event: MouseEvent) {
  const summary = event.target instanceof Element ? event.target.closest("summary") : null;
  const section = summary?.parentElement ?? null;
  if (!isSection(section)) return;
  // After the browser has opened it, the other section has closed and the page has settled.
  requestAnimationFrame(() => {
    if (section.open && section.getBoundingClientRect().top < 0) section.scrollIntoView();
  });
}

export function SectionAccordion() {
  useEffect(() => {
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    document.addEventListener("click", keepInView);
    return () => {
      window.removeEventListener("hashchange", openFromHash);
      document.removeEventListener("click", keepInView);
    };
  }, []);

  return null;
}
