// Class names shared by controls that appear on more than one page, so each look is defined once.
// Tailwind only finds class names written out in full, so add to these strings, never build them.

// The main action on a page, such as Search. A pill in the standard design that fades on hover; in
// the adult-centred design a plain rounded box that darkens, with nothing moving (CCARE-179).
export const primaryButtonClass =
  "h-11 rounded-full bg-primary px-5 font-semibold text-on-primary shadow-sm transition hover:opacity-90 hover:shadow-md adult:rounded-md adult:shadow-none adult:transition-none adult:hover:bg-primary-hover adult:hover:opacity-100";

// A band the full width of the window, breaking out of the page's column and padding, as on the
// home page. Add the background and spacing for where it sits.
export const fullWidthClass = "mx-[calc(50%-50vw)] w-screen";

// The search page's column from xl up when its results have the map beside the list (CCARE-230): up
// to 96rem, wider than the site's (page-column, globals.css), so that both fit. The first is for a
// page-column, as the bar's; the second for a block inside the site's column and its padding, as the
// results, which it widens by the same on each side. The two then have the same edges.
export const widePageColumnClass = "xl:max-w-[96rem]";
export const widerThanPageClass = "xl:mx-[calc(50%_-_min(50vw,48rem)_+_2rem)]";

// A link styled as a large button, such as "Read guide" or "See contacts": a call to action. On a
// brand-colour band (brand-band, globals.css) it turns white with brand-colour text. In the
// standard design it is a pill that lifts a little on hover, and its arrow (an aria-hidden span)
// nudges forward; the adult-centred design keeps it still (CCARE-179).
export const actionLinkClass =
  "inline-flex min-h-12 items-center gap-2 py-2 rounded-full bg-primary px-6 font-semibold text-on-primary no-underline shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-hover hover:text-on-primary hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 adult:rounded-md adult:px-5 adult:shadow-none adult:transition-none adult:hover:translate-y-0 [&>span[aria-hidden]]:transition-transform hover:[&>span[aria-hidden]]:translate-x-1 adult:hover:[&>span[aria-hidden]]:translate-x-0";

// An action link stretched over the card it sits in, so the whole card is the link (WCAG 2.5.5):
// the same look, without the lift. A transform would make the link the box its ::after fills, and
// the card's target would shrink to the button under the pointer. The card lifts instead.
export const stretchedActionClass =
  "inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-on-primary no-underline shadow-sm after:absolute after:inset-0 hover:bg-primary-hover hover:text-on-primary adult:rounded-md adult:px-5 adult:shadow-none";

// The second choice beside an action link, such as "Learn how to choose a nursing home": the same
// shape, outlined on the page's surface.
export const secondaryLinkClass =
  "inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface px-6 py-2 font-semibold text-ink no-underline transition hover:-translate-y-0.5 hover:border-primary hover:text-ink hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0 adult:rounded-md adult:px-5 adult:transition-none adult:hover:translate-y-0 [&>span[aria-hidden]]:transition-transform hover:[&>span[aria-hidden]]:translate-x-1 adult:hover:[&>span[aria-hidden]]:translate-x-0";

// A smaller outlined button for a link inside a card or a step, such as a guide's "Open Fair Deal
// Explained": the secondary link's shape at the height of a tap target, so a step with a link
// stays compact. Underlined in the adult-centred design, like its other links.
export const smallLinkButtonClass =
  "inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-semibold text-ink no-underline hover:border-primary hover:text-ink adult:rounded-md adult:underline";

// A card that is a link as a whole, such as the home page's ways to start: it lifts on hover, with a
// stronger shadow and a primary edge. Add the layout and padding for where it sits.
export const linkCardClass =
  "group rounded-2xl border border-line bg-surface text-ink no-underline shadow-sm transition hover:-translate-y-1 hover:border-primary hover:text-ink hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 adult:rounded-lg adult:shadow-none adult:transition-none adult:hover:translate-y-0";

// A small line over a heading that says who a section is for or where it fits, such as "For
// families". In the warm accent colour, in capitals in the standard design only.
export const eyebrowClass =
  "text-sm font-semibold uppercase tracking-wider text-accent adult:normal-case adult:tracking-normal";

// A text field. The ring replaces the focus outline in the standard design (WCAG 2.4.7).
export const textInputClass =
  "h-11 min-w-0 rounded-lg border border-field bg-surface px-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary";

// A control for a feature that isn't ready: dashed and readable rather than faded, with
// "(coming soon)" in its label. Add the size and font for where it sits.
export const comingSoonClass =
  "cursor-not-allowed rounded-md border-2 border-dashed border-field bg-surface-muted text-ink-muted";
