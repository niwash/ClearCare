"use client";

import { useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

// The standard design's navigation on phones and tablets: a round "Menu" button fixed to the
// bottom-right corner, within thumb reach, that opens the links in a panel above it. Hidden on
// desktop, and in the adult-centred design, which keeps the links visible in the header instead
// (hidden menus are easy to miss).
export function MobileMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  // Close once a link is followed, so the next page doesn't open with the menu over it.
  function closeOnLink(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  }

  // Escape closes the menu and puts focus back on the button, rather than on a link that's now hidden.
  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || !open) return;
    setOpen(false);
    button.current?.focus();
  }

  // Close when focus moves out of the button and the links, such as Tab past the last link.
  function closeOnFocusLeave(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }

  return (
    <div className="lg:hidden adult:hidden" onKeyDown={closeOnEscape} onBlur={closeOnFocusLeave}>
      {/* Closes the menu on a tap anywhere else. */}
      {open && <div aria-hidden className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      {/* Before the links, so Tab from the open button goes straight to "Search for Homes". Both
          are fixed in place, so the order doesn't change where they appear. */}
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        // The welcome tour points here on its steps about the links, on phones and tablets.
        data-tour="menu"
        aria-label={open ? "Close menu" : "Menu"}
        className="fixed bottom-6 right-4 z-50 flex size-14 items-center justify-center rounded-full border-2 border-ink bg-primary text-on-primary shadow-lg hover:bg-primary-hover"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <nav
        id="mobile-menu"
        aria-label="Main"
        onClick={closeOnLink}
        className={`fixed bottom-24 right-4 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface px-4 py-2 shadow-xl ${open ? "block" : "hidden"}`}
      >
        {children}
      </nav>
    </div>
  );
}
