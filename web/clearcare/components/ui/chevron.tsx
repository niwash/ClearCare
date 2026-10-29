// components/ui/chevron.tsx
// The arrow on the site's <details> sections, and the "Show / Hide" words that go with it, so it is
// clear a section opens. Decorative: the summary's own words say what opens.

// Points right when closed and down when open. The caller sets the size, the colour (it takes the
// text's) and which group's open state turns it, since some <details> sit inside another.
export function Chevron({ className }: { className: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform motion-reduce:transition-none ${className}`}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

// The open-state classes for each kind of group. Written out in full so Tailwind finds them. A
// <details> holding others takes "group/section", so the ones inside, with plain "group", don't
// turn its arrow, and it doesn't turn theirs.
const SHOW_HIDE_CLASSES = {
  default: { show: "group-open:hidden", hide: "hidden group-open:inline", chevron: "size-5 group-open:rotate-90" },
  section: {
    show: "group-open/section:hidden",
    hide: "hidden group-open/section:inline",
    chevron: "size-5 group-open/section:rotate-90",
  },
} as const;

// "Show" while closed, "Hide" while open, then the arrow: the right-hand end of a summary whose
// <details> has the "group" class ("group/section" with group="section"). className places it,
// e.g. in a grid.
export function ShowHide({ className = "", group = "default" }: { className?: string; group?: keyof typeof SHOW_HIDE_CLASSES }) {
  const classes = SHOW_HIDE_CLASSES[group];
  return (
    <span className={`flex shrink-0 items-center gap-1 text-sm font-semibold text-primary ${className}`}>
      <span className={classes.show}>Show</span>
      <span className={classes.hide}>Hide</span>
      <Chevron className={classes.chevron} />
    </span>
  );
}
