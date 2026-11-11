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

// "small" sits beside a name in a list; "large" heads a card.
// className adds to the circle, such as reveal-pop (globals.css) on the home page's cards.
export function IconCircle({
  path,
  size = "small",
  tint = "band",
  className = "",
}: {
  path: string;
  size?: "small" | "large";
  tint?: Tint;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full ${TINT_CLASSES[tint]} ${size === "large" ? "size-12" : "size-8"} ${className}`}
    >
      {/* A 24-unit grid, like the site's other icons. */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={size === "large" ? "size-6" : "size-4"}
      >
        <path d={path} />
      </svg>
    </span>
  );
}
