"use client";

// components/centre/regulation-theme-icon.tsx
// The theme a regulation is grouped under on the regulations page (CCARE-261), as its icon in its
// tinted circle, before the regulation's title where a home's findings are listed (CCARE-298), so a
// family sees at a glance which areas a home's problems fall into, such as several about safety.
//
// Always in its circle, so it can't be taken for a judgement's mark, which has none. Decorative: the
// regulation's title is always beside it, so screen readers skip it. Hovering it says which theme it
// is in a small box, at once and in the site's own style, as a browser's title only shows after a
// pause and doesn't say what it names. The box is put on the page's top layer, like Definition's
// (components/ui/definition.tsx), as the inspection grid scrolls sideways and would cut it off; so it
// closes when anything scrolls. It opens under the icon, or above it when there isn't room under it,
// such as for an icon at the foot of the window (PR #243 review). The themes are ClearCare's grouping, not HIQA's, and the one lookup
// (regulationTheme, lib/regulation-guide.ts) keeps every page agreeing with the regulations page.
// Nothing for a regulation in no theme (1 and 2, which aren't inspected).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCircle } from "@/components/ui/icon-circle";
import { ICON_PATHS } from "@/components/ui/icons";
import { regulationTheme } from "@/lib/regulation-guide";

// The gap between the icon and the box, and how far the box keeps from the window's edges.
const GAP = 6;
const EDGE = 12;

export function RegulationThemeIcon({
  number,
  size = "xsmall",
  className = "",
}: {
  number: number;
  size?: "xsmall" | "small";
  className?: string;
}) {
  const theme = regulationTheme(number);
  const icon = useRef<HTMLSpanElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<DOMRect | null>(null);
  // Where the box's top goes, worked out once it's drawn and its height is known.
  const [top, setTop] = useState<number | null>(null);

  // Before it's painted: under the icon if it fits, otherwise above it. Drawn hidden until then, so it
  // never shows in the wrong place.
  useLayoutEffect(() => {
    if (!at || !box.current) {
      setTop(null);
      return;
    }
    const height = box.current.offsetHeight;
    const fitsUnder = at.bottom + GAP + height <= window.innerHeight - EDGE;
    setTop(fitsUnder ? at.bottom + GAP : Math.max(EDGE, at.top - GAP - height));
  }, [at]);

  useEffect(() => {
    if (!at) return;
    const close = () => setAt(null);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [at]);

  if (!theme) return null;
  return (
    <span
      ref={icon}
      aria-hidden
      onMouseEnter={() => setAt(icon.current?.getBoundingClientRect() ?? null)}
      onMouseLeave={() => setAt(null)}
      className={`inline-flex shrink-0 cursor-help ${className}`}
    >
      <IconCircle path={ICON_PATHS[theme.icon]} size={size} tint={theme.tint} />
      {at &&
        createPortal(
          // Starting at the icon's left edge, kept inside the window.
          <span
            ref={box}
            aria-hidden
            style={{
              top: top ?? at.bottom + GAP,
              left: at.left,
              maxWidth: `calc(100vw - ${at.left + EDGE}px)`,
              visibility: top === null ? "hidden" : undefined,
            }}
            className="pointer-events-none fixed z-50 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm whitespace-nowrap text-ink shadow-lg adult:rounded-md print:hidden"
          >
            <span className="text-ink-muted">Theme:</span> <span className="font-semibold">{theme.title}</span>
          </span>,
          document.body,
        )}
    </span>
  );
}
