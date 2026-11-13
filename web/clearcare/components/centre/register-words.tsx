// components/centre/register-words.tsx
// HIQA's words from the register, such as a condition of registration, quoted as the register prints
// them and never summarised (CCARE-235). A condition can run to a long paragraph, so it shows its
// first two lines until the reader opens it. The words are in the page once, whole: the clamp is
// only how they look, so a screen reader and paper get all of them, and nothing needs a script.
// What opens them is a <details> beside them, and wordsGroupClass on the element that holds both
// lets the words follow it.
import { Chevron } from "@/components/ui/chevron";
import type { ReactNode } from "react";

export const wordsGroupClass = "group/words";

export function ClampedWords({ text }: { text: string }) {
  return (
    <blockquote className="line-clamp-2 leading-relaxed text-ink group-has-[details[open]]/words:line-clamp-none print:line-clamp-none">
      “{text}”
    </blockquote>
  );
}

// what: the words it opens, for its label, "condition 4" or "the conditions". children: anything
// more to show once open, such as a condition's earlier words.
export function WordsToggle({ what, children }: { what: string; children?: ReactNode }) {
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-primary print:hidden [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Read {what} in full</span>
        <span className="hidden group-open:inline">Show less</span>
        <Chevron className="size-4 group-open:rotate-90" />
      </summary>
      {children}
    </details>
  );
}
