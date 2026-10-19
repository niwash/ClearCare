"use client";

import { useState, type MouseEvent, type ReactNode } from "react";

// The standard design's navigation on phones and tablets: a round "Menu" button fixed to the
// bottom-right corner, within thumb reach, that opens the links in a panel above it. Hidden on
// desktop, and in the adult-centred design, which keeps the links visible in the header instead
// (hidden menus are easy to miss).
export function MobileMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Close once a link is followed, so the next page doesn't open with the menu over it.
  function closeOnLink(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  }

  return (
    <div className="lg:hidden adult:hidden" onKeyDown={(event) => event.key === "Escape" && setOpen(false)}>
      {/* Closes the menu on a tap anywhere else. */}
      {open && <div aria-hidden className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <nav
        id="mobile-menu"
        aria-label="Main"
        onClick={closeOnLink}
        className={`fixed bottom-24 right-4 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface px-4 py-2 shadow-xl ${open ? "block" : "hidden"}`}
      >
        {children}
      </nav>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Menu"}
        className="fixed bottom-6 right-4 z-50 flex size-14 items-center justify-center rounded-full border-2 border-black bg-primary text-on-primary shadow-lg hover:bg-primary-hover"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
    </div>
  );
}
