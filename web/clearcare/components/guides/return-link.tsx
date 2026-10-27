"use client";

// "← Back to How to navigate ClearCare": shown on a guide opened from one of that guide's steps,
// which sends ?from=using-clearcare&step=N (CCARE-164), under the guide's banner and before its
// "Other guides". It goes back to the same step. Read in the browser, so the guides stay
// prerendered (wrap it in <Suspense>); only the guides listed in RETURNS can be "from", so the
// address can't point the link anywhere else.
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const RETURNS: Record<string, { href: string; label: string }> = {
  "using-clearcare": { href: "/guides/using-clearcare", label: "Back to How to navigate ClearCare" },
};

export function ReturnLink() {
  const params = useSearchParams();
  const back = RETURNS[params.get("from") ?? ""];
  if (!back) return null;
  const step = params.get("step");
  const href = step && /^\d{1,2}$/.test(step) ? `${back.href}#step-${step}` : back.href;

  return (
    <Link
      href={href}
      className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-line bg-surface px-4 font-semibold text-ink no-underline hover:border-primary hover:text-ink"
    >
      <span aria-hidden>←</span> {back.label}
    </Link>
  );
}
