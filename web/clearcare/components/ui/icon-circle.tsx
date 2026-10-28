// components/ui/icon-circle.tsx
// A stroked icon in a circle of the band colour, shared by the organisation icons and the home
// page's features and figures. Decorative: whatever it sits beside always says the same in words.

// "small" sits beside a name in a list; "large" heads a card.
export function IconCircle({ path, size = "small" }: { path: string; size?: "small" | "large" }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-band text-primary ${size === "large" ? "size-12" : "size-8"}`}
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
