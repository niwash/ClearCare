import type { Metadata } from "next";
import Link from "next/link";
import type { Guide } from "@/lib/guides";

export function guideMetadata(guide: Guide): Metadata {
  return { title: `${guide.title} · ClearCare`, description: guide.summary };
}

// Shared top of every guide; the rest of each guide page sets its own layout.
export function GuideHeader({ guide }: { guide: Guide }) {
  return (
    <header className="flex max-w-3xl flex-col gap-3">
      <Link href="/resources" className="text-sm">
        ← Back to resources
      </Link>
      <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-5xl">{guide.title}</h1>
      <p className="text-ink-muted md:text-lg">{guide.summary}</p>
    </header>
  );
}
