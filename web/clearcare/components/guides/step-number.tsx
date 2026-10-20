// components/guides/step-number.tsx
// The numbered pieces the guides share: a number in a circle of brand colour, and a row of
// numbered links down to a guide's sections or stages. Decorative numbers are hidden from screen
// readers, which hear the step from the heading or the list instead.

// "large" sits beside a section's heading; "small" beside a card's text.
export function StepNumber({ number, size = "large" }: { number: number; size?: "large" | "small" }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-primary text-on-primary ${
        size === "large" ? "size-10 font-heading text-lg font-semibold md:size-12 md:text-xl" : "size-8 font-semibold"
      }`}
    >
      {number}
    </span>
  );
}

// A guide's sections at a glance, each a link down to its id, numbered in order.
export function ContentsNav({ label, items }: { label: string; items: readonly { id: string; title: string }[] }) {
  return (
    <nav aria-label={label} className="max-w-4xl">
      <ol className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4 text-sm font-semibold text-ink no-underline hover:border-primary hover:text-ink"
            >
              <span aria-hidden className="grid size-8 place-items-center rounded-full bg-primary text-on-primary">
                {index + 1}
              </span>
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
