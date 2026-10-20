import type { Metadata } from "next";
import Link from "next/link";
import type { Guide } from "@/lib/guides";

export function guideMetadata(guide: Guide): Metadata {
  return { title: `${guide.title} · ClearCare`, description: guide.summary };
}

// Marks a guide that is readable but still changing, on its page, its card and its home page
// slide. Worded for readers ("Work in progress") rather than as "Draft".
export function DraftLabel() {
  return (
    <span className="w-fit rounded border border-field px-1.5 py-0.5 text-xs font-normal text-ink-muted">
      Work in progress
    </span>
  );
}

// Shared top of every guide; the rest of each guide page sets its own layout.
export function GuideHeader({ guide }: { guide: Guide }) {
  return (
    <header className="flex max-w-3xl flex-col gap-3">
      <Link href="/resources" className="text-sm tap-target">
        ← Back to resources
      </Link>
      <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-5xl">{guide.title}</h1>
      {guide.status === "draft" && <DraftLabel />}
      <p className="text-ink-muted md:text-lg">{guide.summary}</p>
    </header>
  );
}
