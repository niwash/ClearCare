"use client";

// components/compare/collapsible-group.tsx
// A group of the comparison grid on Compare Homes (CCARE-189) that folds, so a family can put away
// what they've read instead of scrolling past it. Its heading row is a button with "Hide" or "Show"
// and the arrow, as on the site's <details> sections; the group starts open. The heading row sticks
// under the bar of names (StickyHomeNames sets --names-bar), so it's clear which group a row is in,
// with the group's intro beside it, over the homes' columns. Two <tbody>s, the heading's and the
// rows', since a table can't hold a <details>.
import { useId, useState, type ReactNode } from "react";
import { Chevron } from "@/components/ui/chevron";

// Each cell sticks, as a table row can't, above the rows. Its thin lines above and below are inset
// shadows, as a collapsed table's borders stay behind when a cell sticks.
const stuckClass =
  "sticky top-[var(--names-bar,0px)] z-10 bg-surface-muted shadow-[inset_0_1px_0_var(--color-line),inset_0_-1px_0_var(--color-line)]";

export function CollapsibleGroup({
  heading,
  intro,
  span,
  headingCellClass,
  children,
}: {
  heading: ReactNode; // the icon and title
  intro?: ReactNode;
  span: number; // how many home columns there are
  headingCellClass: string;
  children: ReactNode; // the rows
}) {
  const id = useId();
  const [open, setOpen] = useState(true);
  return (
    <>
      <tbody>
        <tr>
          <th scope="colgroup" className={`${headingCellClass} ${stuckClass}`}>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-controls={id}
              className="flex min-h-10 w-full items-center gap-2.5 text-left adult:min-h-11"
            >
              {heading}
            </button>
          </th>
          <td colSpan={span} className={`${stuckClass} px-3 py-2 align-middle`}>
            <div className="flex items-center gap-4">
              <div className="flex-1 text-sm text-ink-muted">{open && intro}</div>
              {/* A second way to the same button, at the row's far end where the eye looks for it. */}
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                onClick={() => setOpen(!open)}
                className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary"
              >
                {open ? "Hide" : "Show"}
                <Chevron className={`size-5 ${open ? "rotate-90" : ""}`} />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
      <tbody id={id} hidden={!open}>
        {children}
      </tbody>
    </>
  );
}
