"use client";

// "Your shortlist" (CCARE-127, CCARE-179): the homes saved to compare, each with a ✕, an empty slot
// for each one still free, and a link to Compare Homes. With nothing saved it says how to add a
// home; once the list is full, it says so. It is the content of the panel that slides in from the
// side (ShortlistDrawer), on the search page and on a home's record, where that home is marked as
// "This home" (currentId). On the record it was a box under the home's actions until CCARE-212,
// which took more height than the actions themselves.
import Link from "next/link";
import { actionLinkClass } from "@/components/ui/classes";
import { compareHref, MAX_COMPARED, SHORTLIST_FULL_ID } from "@/lib/compare";
import { CompareButton } from "./compare-button";
import { useComparedHomes } from "./compare-store";

export function ShortlistBox({ currentId }: { currentId?: string }) {
  const homes = useComparedHomes() ?? [];
  const room = MAX_COMPARED - homes.length;

  return (
    <section aria-labelledby="shortlist-h" className="flex flex-col gap-3">
      {/* tabIndex -1: focus comes here when a ✕ takes its home, and itself, away. */}
      <h2 id="shortlist-h" tabIndex={-1} className="font-heading text-lg font-semibold md:text-xl">
        Your shortlist{" "}
        <span className="font-sans text-base font-normal text-ink-muted">
          · {homes.length} of {MAX_COMPARED}
        </span>
      </h2>
      {homes.length === 0 && (
        <p className="text-sm text-ink-muted">
          Choose <strong className="text-ink">Add to shortlist</strong> on a home to save it here, then see up to{" "}
          {MAX_COMPARED} side by side.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {homes.map((home) => (
          <li key={home.id} className="flex items-center justify-between gap-1 rounded-md border border-line bg-surface-muted py-0.5 pl-3 pr-0.5">
            {/* "This home" sits outside the link, so it doesn't take the link's underline. */}
            <div className="flex min-w-0 flex-col py-2">
              <Link
                href={`/centres/${home.id}`}
                aria-current={home.id === currentId ? "page" : undefined}
                className="text-sm font-semibold leading-snug text-ink"
              >
                {home.name}
              </Link>
              {home.id === currentId && <span className="text-xs text-ink-muted">This home</span>}
            </div>
            <CompareButton home={home} variant="remove" iconOnly bare focusAfter="shortlist-h" className="size-10 shrink-0" />
          </li>
        ))}
        {Array.from({ length: room }, (_, i) => (
          <li key={`slot-${i}`} className="rounded-md border-2 border-dashed border-field px-3 py-2 text-sm text-ink-muted">
            Space for another home
          </li>
        ))}
      </ul>
      {room === 0 && (
        <p id={SHORTLIST_FULL_ID} className="text-sm text-ink-muted">
          You can compare {MAX_COMPARED} homes at a time. Remove one here to add another.
        </p>
      )}
      {homes.length > 0 && (
        <Link href={compareHref(homes.map((home) => home.id))} className={`${actionLinkClass} h-11 justify-center text-sm`}>
          Compare {homes.length === 1 ? "this home" : `these ${homes.length} homes`} <span aria-hidden>→</span>
        </Link>
      )}
    </section>
  );
}
