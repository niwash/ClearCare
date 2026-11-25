// components/ui/icon-circle.tsx
// A stroked icon in a circle of the band colour, shared by the organisation icons and the home
// page's features and figures. Decorative: whatever it sits beside always says the same in words.

// The soft colours a row of cards can use to tell its items apart (globals.css, --tint-*). Written
// out in full so Tailwind finds them. The adult-centred design turns them all to the band colour.
const TINT_CLASSES = {
  band: "bg-band text-primary",
  blue: "bg-tint-blue text-on-tint-blue",
  gold: "bg-tint-gold text-on-tint-gold",
  sage: "bg-tint-sage text-on-tint-sage",
  rose: "bg-tint-rose text-on-tint-rose",
} as const;

export type Tint = keyof typeof TINT_CLASSES;

const CIRCLE_SIZES = { xsmall: "size-6", small: "size-8", large: "size-12" } as const;
const ICON_SIZES = { xsmall: "size-3.5", small: "size-4", large: "size-6" } as const;

// "xsmall" sits beside a line of text, such as a regulation's title in a list (CCARE-298); "small"
// beside a name in a list; "large" heads a card.
// className adds to the circle, such as reveal-pop (globals.css) on the home page's cards.
// children, when given, is drawn in place of the path: an icon of its own in the same circle, such
// as the home page's mission and vision icons, whose parts move (CCARE-258).
export function IconCircle({
  path,
  size = "small",
  tint = "band",
  className = "",
  children,
}: {
  path?: string;
  size?: "xsmall" | "small" | "large";
  tint?: Tint;
  className?: string;
  children?: React.ReactNode;
}) {
  if (children) {
    return (
      <span
        aria-hidden
        className={`grid shrink-0 place-items-center rounded-full ${TINT_CLASSES[tint]} ${CIRCLE_SIZES[size]} ${className}`}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full ${TINT_CLASSES[tint]} ${CIRCLE_SIZES[size]} ${className}`}
    >
      {/* A 24-unit grid, like the site's other icons. */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={ICON_SIZES[size]}
      >
        <path d={path} />
      </svg>
    </span>
  );
}
