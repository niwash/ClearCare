"use client";

// components/guides/section-accordion.tsx
// What a guide whose sections are one-at-a-time <details> needs from the browser: a link to a
// section opens it, and a section that opens stays in view when the one above it closes. The
// sections themselves are server-rendered and work without this; it only adds to them.
import { useEffect } from "react";

// The guide's sections carry data-guide-section, so worked examples and other <details> inside
// them are left alone. The page writes the attribute out itself: a server component can't take a
// constant from this "use client" file.
function isSection(element: EventTarget | null): element is HTMLDetailsElement {
  return element instanceof HTMLDetailsElement && element.hasAttribute("data-guide-section");
}

// Opens the section a link points at (such as /guides/fair-deal#how-much-will-you-pay, from a centre
// page), on arrival and whenever the address's # changes, then brings it into view.
function openFromHash() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return;
  const section = document.getElementById(id)?.closest("details");
  if (!section || section.open) return;
  section.open = true;
  section.scrollIntoView();
}

// Opening a section closes the open one (they share a name). When that one is above, the page
// shrinks over it and can carry the new section's header off the top of the window, so it's
// brought back.
function keepInView(event: Event) {
  const section = event.target;
  if (!isSection(section) || !section.open) return;
  // After the other section has closed and the page has settled.
  requestAnimationFrame(() => {
    if (section.getBoundingClientRect().top < 0) section.scrollIntoView();
  });
}

export function SectionAccordion() {
  useEffect(() => {
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    // "toggle" doesn't bubble, so it's caught on its way down.
    document.addEventListener("toggle", keepInView, true);
    return () => {
      window.removeEventListener("hashchange", openFromHash);
      document.removeEventListener("toggle", keepInView, true);
    };
  }, []);

  return null;
}
