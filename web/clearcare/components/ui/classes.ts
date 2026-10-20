// Class names shared by controls that appear on more than one page, so each look is defined once.
// Tailwind only finds class names written out in full, so add to these strings, never build them.

// The main action on a page, such as Search. It fades on hover in the standard design and darkens
// in the adult-centred one.
export const primaryButtonClass =
  "h-11 rounded-md bg-primary px-4 font-semibold text-on-primary transition-opacity hover:opacity-90 adult:transition-none adult:hover:bg-primary-hover adult:hover:opacity-100";

// A link styled as a large button, such as "Read guide" or "See contacts". On a brand-colour band
// (brand-band, globals.css) it turns white with brand-colour text.
export const actionLinkClass =
  "inline-flex h-12 items-center gap-2 rounded-md bg-primary px-5 font-semibold text-on-primary no-underline hover:bg-primary-hover hover:text-on-primary";

// A text field. The ring replaces the focus outline in the standard design (WCAG 2.4.7).
export const textInputClass =
  "h-11 min-w-0 rounded-md border border-field bg-surface px-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary";

// A control for a feature that isn't ready: dashed and readable rather than faded, with
// "(coming soon)" in its label. Add the size and font for where it sits.
export const comingSoonClass =
  "cursor-not-allowed rounded-md border-2 border-dashed border-field bg-surface-muted text-ink-muted";
