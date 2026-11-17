"use client";

// components/centre/more-regulations.tsx
// The rest of the always-compliant regulations under a home's judgment grid (judgement-grid.tsx),
// behind a "Show more" button at the right, under the ones already in view, where the eye ends up
// after reading them. The list starts shut and slides open (fold, globals.css); print shows it all.
import { useId, useState, type ReactNode } from "react";
import { Chevron } from "@/components/ui/chevron";

export function MoreRegulations({ count, children }: { count: number; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* inert keeps the shut list out of reach; print opens it whatever its state. */}
      <div id={id} className="fold prints-open" data-open={open} inert={!open}>
        <div>{children}</div>
      </div>
      <div className="mt-2 flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={id}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-surface px-4 font-semibold text-primary hover:bg-tint-sage focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink adult:rounded-md"
        >
          {open ? "Show fewer regulations" : `Show ${count} more ${count === 1 ? "regulation" : "regulations"}`}
          <Chevron className={`size-5 ${open ? "-rotate-90" : "rotate-90"}`} />
        </button>
      </div>
    </>
  );
}
