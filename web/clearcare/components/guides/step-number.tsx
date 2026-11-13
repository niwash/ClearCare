// components/guides/step-number.tsx
// The numbered pieces the guides share: a number in a circle of brand colour, a row of numbered
// links down to a guide's sections or stages, and the link back up to it that ends each one.
// Decorative numbers are hidden from screen readers, which hear the step from the heading or the
// list instead.

// Where a jump to a section lands: clear of the top of the window. Give it to every element the
// contents links to.
export const sectionScrollMargin = "scroll-mt-6";

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

// A guide's sections at a glance, each a link down to its id, numbered in order. Its id is the
// target of each section's "Back to contents".
export function ContentsNav({ label, items }: { label: string; items: readonly { id: string; title: string }[] }) {
  return (
    // One row across the page's whole width from desktop width, each link an equal share of it, rather
    // than wrapping onto a second row with the first one's end left empty (CCARE-233). Two to a row
    // on tablets, one under another on phones.
    <nav id={CONTENTS_ID} aria-label={label} className="scroll-mt-6">
      <ol className="grid gap-2 sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none">
        {items.map((item, index) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="flex h-full min-h-11 items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4 text-sm leading-snug font-semibold text-ink no-underline hover:border-primary hover:text-ink"
            >
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-on-primary">
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

const CONTENTS_ID = "contents";

// The end of a numbered section: back up to the contents, so nobody has to scroll to find it.
export function SectionEnd() {
  return (
    <div className="border-t border-line pt-3 text-sm font-semibold">
      <a href={`#${CONTENTS_ID}`} className="inline-flex min-h-11 items-center gap-1.5 tap-target">
        <span aria-hidden>↑</span> Back to contents
      </a>
    </div>
  );
}
