"use client";

// components/search/map-card.tsx
// The card of the home chosen on the search page's map (CCARE-229), in the look of a result card:
// its name, its town and county and how far it is, worded as the result cards word them, and the way
// to its record. Nothing about its inspections: a line or two here would read as a summary of them.
import { distanceText } from "@/lib/near";
import type { CentrePoint } from "@/lib/search-map";
import { townAndCounty } from "@/lib/town";
import Link from "next/link";
import { useId, type Ref } from "react";

export function HomeCard({
  point,
  onClose,
  pointed = false,
  ref,
}: {
  point: CentrePoint;
  onClose: () => void;
  pointed?: boolean; // it stands over its pin, and points down at it
  ref?: Ref<HTMLDivElement>;
}) {
  const heading = useId();
  const distance = distanceText(point.distance_m);

  return (
    // It takes the keyboard's focus when it opens (results-map.tsx), so it can hold it without being
    // a stop of its own; its name is read out, and the link is one Tab on.
    <div
      ref={ref}
      role="group"
      aria-labelledby={heading}
      tabIndex={-1}
      className="relative flex flex-col items-start gap-1 rounded-2xl border border-line bg-surface py-3.5 pl-4 pr-12 text-ink shadow-lg adult:rounded-lg"
    >
      <h3 id={heading} className="font-heading text-lg font-semibold leading-snug">
        {point.centre_name}
      </h3>
      <p className="text-sm text-ink-muted">{townAndCounty(point)}</p>
      {distance && <p className="text-sm font-semibold">{distance}</p>}
      <Link href={`/centres/${point.centre_id}`} className="mt-1 text-sm font-semibold tap-target">
        See this home&apos;s record →
      </Link>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink"
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="size-4">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      {pointed && <span aria-hidden className="absolute left-1/2 top-full -mt-2 size-4 -translate-x-1/2 rotate-45 rounded-br-sm border-b border-r border-line bg-surface" />}
    </div>
  );
}
