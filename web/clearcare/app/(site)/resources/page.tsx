import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Resources · ClearCare",
  description: "Resources for choosing and paying for a nursing home in Ireland. Coming soon.",
};

// TODO: Fill in the resources page (CCARE-53). Until then it says so, so the header link isn't a dead end.
export default function ResourcesPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-5xl">Resources</h1>
      <p className="text-ink-muted md:text-lg">Coming soon.</p>
      <p>
        In the meantime, check out <Link href="/contacts">Contacts</Link> to see who to contact about a nursing home, with guides
        to Fair Deal and reading inspection reports.
      </p>
    </div>
  );
}
