"use client";

// On phones, when a result's "Shortlist full" button is pressed (CCARE-189): a short message
// at the bottom of the screen, with the way to compare, in place of the panel, which would cover the
// results. It goes after a few seconds. The status region is always there, so screen readers read
// the message when it appears.
import Link from "next/link";
import { useEffect, useState } from "react";
import { compareHref, MAX_COMPARED } from "@/lib/compare";
import { onShortlistFull, useComparedHomes } from "./compare-store";

export function ShortlistToast() {
  const homes = useComparedHomes();
  const [shown, setShown] = useState(0);

  useEffect(() => onShortlistFull(() => setShown(Date.now())), []);
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(0), 6000);
    return () => clearTimeout(timer);
  }, [shown]);

  return (
    // Above the floating menu button in the bottom corner (mobile-menu.tsx).
    <div role="status" className="fixed inset-x-3 bottom-24 z-40 md:hidden">
      {shown > 0 && homes && (
        <div className="flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-page shadow-xl adult:rounded-lg">
          <span className="flex-1 text-sm leading-snug">
            Your shortlist holds {MAX_COMPARED} homes. Remove one, or compare them.
          </span>
          <Link
            href={compareHref(homes.map((home) => home.id))}
            className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-bold text-page"
          >
            Compare →
          </Link>
        </div>
      )}
    </div>
  );
}
