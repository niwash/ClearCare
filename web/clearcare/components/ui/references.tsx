// components/ui/references.tsx
// A page's References, folded at its foot, and the in-text citations that lead to them (CCARE-299),
// first made for the regulations page (CCARE-261). The sources are in lib/references.ts; a page picks
// its own with pageReferences, which letters them for that page ("HSE, n.d.a").
//
// Folded, as most readers won't need it. Pressing a citation opens it and lands on its entry
// (OpenOnJump), and so does an address with an entry's anchor (/guides/fair-deal#ref-hse-nhss).
import type { ReactNode } from "react";
import { ShowHide } from "@/components/ui/chevron";
import { OpenOnJump } from "@/components/ui/open-on-jump";
import type { Reference } from "@/lib/references";

// The folded section's id, which every citation's entry sits inside.
const REFERENCES_ID = "references";

// An in-text citation: "HIQA, 2025", leading to its entry in the page's References. The brackets are
// the caller's, as a citation can sit inside a sentence's own.
export function Cite({ reference }: { reference: Reference }) {
  return (
    <a href={`#${reference.id}`} className="text-ink-muted">
      {reference.cite}
    </a>
  );
}

export function References({
  references,
  note,
  className = "",
}: {
  references: Reference[];
  // Small print under the list, such as which words are quoted and which are ClearCare's.
  note?: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label="References" className={`w-full max-w-3xl ${className}`}>
      <OpenOnJump />
      {/* On the light blue tint, apart from the stone panels the guides set beside it ("Key things to
          remember", "Quick checklist"). The adult-centred design turns it to its band colour. */}
      <details
        id={REFERENCES_ID}
        className="group scroll-mt-6 rounded-2xl bg-tint-blue text-ink adult:rounded-lg adult:border adult:border-line"
      >
        {/* The heading and Show/Hide alone: "References" says what is inside. */}
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 [&::-webkit-details-marker]:hidden">
          <h2 className="font-heading text-xl font-semibold md:text-2xl">References</h2>
          <ShowHide />
        </summary>
        <div className="flex flex-col gap-3 px-6 pb-6">
          {/* A bullet each, so where one entry ends and the next begins is plain. */}
          <ul className="flex list-disc flex-col gap-3 pl-5 text-sm leading-relaxed marker:text-on-tint-blue">
            {references.map((reference) => (
              <li key={reference.id} id={reference.id} className="scroll-mt-6">
                <span className="font-semibold">{reference.cite}.</span> {reference.author} ({reference.shownYear}){" "}
                <cite>{reference.title}</cite>. {reference.detail} Available at:{" "}
                <a href={reference.url} target="_blank" rel="noopener noreferrer" className="break-all">
                  {reference.url}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
          {note && <p className="text-sm text-ink-muted">{note}</p>}
        </div>
      </details>
    </section>
  );
}
