"use client";

// components/theme/display-menu.tsx
// "Display options": one button in the header that opens Easier to read and Dark mode, each with a line on
// what it does (CCARE-318). The two were buttons side by side in the header, which had grown
// crowded; in user testing one participant didn't like how they looked there (P2_6), another
// felt they didn't belong beside the shortlist and login and asked for an accessibility option
// (P2_2), another couldn't find Easier to read (P2_3), and another expected it to make the
// wording simpler rather than the design (P2_5), which the line under it now answers.
//
// The panel stays open while the visitor tries each setting, so they see what it does. Escape or a
// click outside closes it, and Escape returns the focus to the button.
import { useEffect, useId, useRef, useState } from "react";
import { AccessibilityIcon } from "./accessibility-icon";
import { DesignToggle } from "./design-toggle";
import { ThemeIcon, ThemeToggle, useShownTheme } from "./theme-toggle";

export function DisplayMenu() {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const dark = useShownTheme() === "dark";

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    // data-tour: the welcome tour's step about display points here.
    <div ref={wrapper} data-tour="display" className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-line px-3 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        {/* The accessibility figure and the sun or moon of the mode being shown, beside the word,
            so what it opens isn't guessed. */}
        <AccessibilityIcon />
        <ThemeIcon dark={dark} />
        Display options
      </button>

      {/* Right-aligned under the button, as the header's buttons sit at its right; never wider than
          the window less a margin, so it fits a 375px phone. page-colours (globals.css) gives it the
          page's own light or dark colours, not the header band's blue. */}
      <div
        id={panelId}
        hidden={!open}
        className="page-colours absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-4 text-ink shadow-lg"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <DesignToggle />
            <p className="text-sm text-ink-muted">
              Larger text, stronger contrast, underlined links, less animation and a highlight around the mouse
              pointer.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <ThemeToggle />
            <p className="text-sm text-ink-muted">Light text on a dark background.</p>
          </div>
          <p className="text-xs text-ink-muted">Your choices are remembered on this device.</p>
        </div>
      </div>
    </div>
  );
}
