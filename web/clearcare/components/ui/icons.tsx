// components/ui/icons.tsx
// The site's generic icons, drawn for ClearCare: one stroked path each on a 24-unit grid, like
// ExternalIcon. Icon draws one inline, beside a label or a link's words; IconCircle
// (icon-circle.tsx) draws one in a circle. Decorative either way: the words beside an icon always
// say the same, so screen readers skip it.

export const ICON_PATHS = {
  // A pin on a map
  address: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  // A folded map
  county: "M9 4 3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5zM9 4v13.5M15 6.5V20",
  // An envelope
  email: "M3 6h18v12H3zM3 7l9 6 9-6",
  // A hash sign, for an ID
  id: "M5 9h14M5 15h14M10 4 8 20M16 4l-2 16",
  // A telephone handset
  phone: "M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  // A globe
  website:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z",
  // A bed
  beds: "M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  // A house
  home: "M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5M10 20v-5h4v5",
  // A euro sign in a coin
  cost: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 8.8a4 4 0 1 0 0 6.4M7.5 11h5M7.5 13.5h5",
  // A page with lines
  report: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  // A list of ticks
  results: "M10 6h10M10 12h10M10 18h10M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  // A calendar
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  // A clipboard
  inspection: "M9 4h6v3H9zM9 5.5H6V21h12V5.5h-3M9 12h6M9 16h4",
  // A magnifying glass
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  // An open book
  guides: "M12 6.5C10 5 7 4.5 4 5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v14",
  // An arrow down onto a line
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  // An "i" in a circle
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  // A speech bubble
  talk: "M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5",
  // A target
  mission:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  // A light bulb
  vision: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
} as const;

export type IconName = keyof typeof ICON_PATHS;

// An icon inline with text, in the text's colour. The caller sets the size, e.g. "size-4".
export function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
