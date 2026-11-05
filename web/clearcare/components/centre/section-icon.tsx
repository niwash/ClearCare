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
