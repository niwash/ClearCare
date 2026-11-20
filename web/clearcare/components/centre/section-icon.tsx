// components/centre/section-icon.tsx
// The look the centre page's sections share. Their headings carry the warm accent mark
// (.accent-heading, globals.css).

// Every section's heading, one size for all, the same as the guides band's at the end of the page,
// with the accent mark before it. Shared so the headings don't drift apart.
export const sectionHeadingClass =
  "accent-heading flex items-center gap-3 font-heading text-2xl font-semibold tracking-tight md:text-3xl";

// The card each section sits on: rounded and lifted a little in the standard design, like the
// "About this home" box; square-cornered with a 3:1 edge and no shadow in the adult-centred one.
export const sectionCardClass =
  "rounded-2xl border border-line-soft bg-surface shadow-sm adult:rounded-lg adult:border-line adult:shadow-none";

// The heading over each part of a section's card, such as the timeline and the grid on Inspection
// history (CCARE-278): the size and face of the site's other subheadings (the guides', the promise
// trails', the shortlist's), so the card reads as its parts at a glance. Shared so the two columns'
// headings match.
export const partHeaderClass = "mb-4 flex flex-col gap-1";
export const partHeadingClass = "font-heading text-lg font-semibold text-ink md:text-xl";

// Where a jump to a section or a trail lands: a little below the top of the window, so its heading
// isn't pressed against the edge. The header doesn't stay on screen, and the record's pages have no
// sticky menu since the sections became pages (CCARE-212), so this is all the room it needs.
export const sectionScrollMargin = "scroll-mt-6";
