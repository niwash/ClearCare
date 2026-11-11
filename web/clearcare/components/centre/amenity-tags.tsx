// components/centre/amenity-tags.tsx
"use client";

import type { AmenityEvidence, AmenityItem } from "@/lib/centres";
import { useEffect, useId, useRef, useState } from "react";
import { AmenityIcon } from "./amenity-icon";

// One row's amenities in the standard design (CCARE-163). Hovering, focusing or tapping an item
// opens a panel under the row with the passages it was read from. The easier-to-read design shows
// plain tags and an accordion instead (centre-amenities.tsx), since a panel that comes and goes
// with the pointer is harder to follow.
export function AmenityTags({ items, reportUrl }: { items: AmenityItem[]; reportUrl?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const active = items.find(({ item }) => item === open);

  // A tap elsewhere closes it. Phones don't move focus on a tap, so blur alone wouldn't.
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseLeave={() => setOpen(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(null);
      }}
    >
      <ul className="flex flex-wrap gap-1.5">
        {items.map(({ item }) => (
          <li key={item}>
            {/* Opens rather than toggles on click: a tap also fires mouseenter first. */}
            <button
              type="button"
              aria-expanded={open === item}
              aria-controls={panelId}
              onMouseEnter={() => setOpen(item)}
              onFocus={() => setOpen(item)}
              onClick={() => setOpen(item)}
              className="inline-flex cursor-help items-center gap-1.5 rounded-full bg-tint-sage px-2.5 py-0.5 text-sm text-on-tint-sage underline decoration-dotted decoration-1 underline-offset-4 outline-offset-2 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-ink aria-expanded:decoration-solid aria-expanded:ring-1 aria-expanded:ring-on-tint-sage"
            >
              <AmenityIcon item={item} />
              {item}
            </button>
          </li>
        ))}
      </ul>
      {/* pt-2 rather than a margin, so the pointer stays inside on its way from the item to the panel. */}
      {active && (
        <div id={panelId} className="absolute inset-x-0 top-full z-20 pt-2">
          <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-3 shadow-lg">
            <p className="text-sm font-semibold text-ink">Where the report says &ldquo;{active.item}&rdquo;</p>
            <Passages evidence={active.evidence} reportUrl={reportUrl} />
          </div>
        </div>
      )}
    </div>
  );
}

// The passages an item was read from, in the AI tool's words (not checked), each with its pages.
export function Passages({ evidence, reportUrl }: { evidence: AmenityEvidence[]; reportUrl?: string }) {
  return (
    <>
      {evidence.map((passage, index) => (
        <blockquote key={index} className="border-l-2 border-line pl-3 text-sm text-ink-muted">
          &ldquo;{passage.quote}&rdquo; <Pages passage={passage} reportUrl={reportUrl} />
        </blockquote>
      ))}
    </>
  );
}

// "page 6" or "pages 6 to 7", linked to that page of the PDF when ClearCare has it. Browsers' PDF
// viewers open at #page=N, and the extractor counts pages the same way, cover included.
function Pages({ passage, reportUrl }: { passage: AmenityEvidence; reportUrl?: string }) {
  const { page_start: start, page_end: end } = passage;
  const text = end > start ? `pages ${start} to ${end}` : `page ${start}`;
  return (
    <span className="whitespace-nowrap">
      ({reportUrl ? <a href={`${reportUrl}#page=${start}`}>{text}</a> : text})
    </span>
  );
}
