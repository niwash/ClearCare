"use client";

// "← Back to How to navigate ClearCare": shown on a guide opened from one of that guide's steps,
// which sends ?from=using-clearcare&step=N (CCARE-164), under the guide's banner and before its
// "Other guides". It goes back to the same step. Or "← Back to the home: What to ask", on a guide
// opened from a home's record (CCARE-212, lib/return-to-centre.ts), back to the tab it came from.
// Read in the browser, so the guides stay prerendered (wrap it in <Suspense>); only those two are
// accepted as "from", so the address can't point the link anywhere else.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { returnToCentre } from "@/lib/return-to-centre";

const back = { href: "/guides/using-clearcare", label: "Back to How to navigate ClearCare" };

export function ReturnLink() {
  const params = useSearchParams();
  const centre = returnToCentre(new URLSearchParams(params.toString()));
  if (centre) return <BackLink href={centre.href} label={centre.label} />;
  // A plain comparison, not a lookup in an object: "?from=constructor" would match an inherited key.
  if (params.get("from") !== "using-clearcare") return null;
  const step = params.get("step");
  const href = step && /^\d{1,2}$/.test(step) ? `${back.href}#step-${step}` : back.href;
  return <BackLink href={href} label={back.label} />;
}

function BackLink({ href, label }: { href: string; label: string }) {

  return (
    <Link
      href={href}
      className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-line bg-surface px-4 font-semibold text-ink no-underline hover:border-primary hover:text-ink"
    >
      <span aria-hidden>←</span> {label}
    </Link>
  );
}
