import type { Metadata } from "next";
import { RESOURCES_CRUMB } from "@/components/layout/breadcrumb";
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

// A guide sits under Resources, unless the site header's menu links to it (Fair Deal): then it
// is a main page, a step down from Home like the other pages in the menu.
export function guideTrail(guide: Guide) {
  return guide.inMenu ? [] : [RESOURCES_CRUMB];
}
