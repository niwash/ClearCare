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
import { GROUP_HEADING } from "./sticky-home-names";

// Each cell sticks, as a table row can't, above the rows, in warm stone (--section) so it stands out
// from the rows' background. The border round the heading is drawn as inset shadows, as a collapsed
// table's borders stay behind when a cell sticks: the label cell takes the left side, the other cell
// the right, so no line runs between them.
const stuckClass = "sticky top-[var(--names-bar,0px)] z-10 bg-section";
// Written out in full so Tailwind finds them.
const labelEdgeClass =
  "shadow-[inset_0_1px_0_var(--color-section-line),inset_0_-1px_0_var(--color-section-line),inset_1px_0_0_var(--color-section-line)]";
const endEdgeClass =
  "shadow-[inset_0_1px_0_var(--color-section-line),inset_0_-1px_0_var(--color-section-line),inset_-1px_0_0_var(--color-section-line)]";

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
        <tr {...{ [GROUP_HEADING]: "" }}>
          <th scope="colgroup" className={`${headingCellClass} ${stuckClass} ${labelEdgeClass}`}>
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
          <td colSpan={span} className={`${stuckClass} ${endEdgeClass} px-3 py-2 align-middle`}>
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
      {/* Slides shut and open (fold-rows, globals.css); inert keeps it out of reach while shut. */}
      <tbody id={id} className="fold-rows" data-open={open} inert={!open}>
        {children}
      </tbody>
    </>
  );
}
