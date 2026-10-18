// components/national/bar-list.tsx
// Labelled horizontal bars. The labels and values are text in the list, so the list is its own
// text alternative and the bars are hidden from screen readers.
import type { ReactNode } from "react";

export type BarRow = {
  label: ReactNode;
  fraction: number | null; // of the full bar length; null for a row with no bar
  value: string;
};

// The full bar length leaves this much room for the value printed at the bar end, so it never
// wraps or overflows at phone width.
const VALUE_ROOM = "10rem";

export function BarList({ rows }: { rows: BarRow[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row, index) => (
        <li key={index}>
          <div className="text-sm">{row.label}</div>
          <div className="mt-1 flex min-h-5 items-center gap-2">
            {row.fraction !== null && <Bar fraction={row.fraction} />}
            <span className="whitespace-nowrap text-sm font-medium">{row.value}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Square at the baseline and rounded at its end: the rounded rect is squared off by a second rect
// over its left half, which works without knowing the bar's width in pixels.
function Bar({ fraction }: { fraction: number }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 shrink-0 fill-link"
      style={{ width: `calc((100% - ${VALUE_ROOM}) * ${fraction})` }}
    >
      <rect width="100%" height="100%" rx="4" />
      <rect width="50%" height="100%" />
    </svg>
  );
}
