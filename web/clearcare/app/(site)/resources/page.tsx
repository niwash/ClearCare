import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/layout/section";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Resources · ClearCare",
  description: "Guides to choosing and paying for a nursing home in Ireland.",
};

export default function ResourcesPage() {
  return (
    <>
      <div className="flex max-w-3xl flex-col gap-3">
        <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-5xl">Resources</h1>
        <p className="text-ink-muted md:text-lg">
          Help with choosing and paying for a nursing home. For who to call, see <Link href="/contacts">Contacts</Link>.
        </p>
      </div>

      <Section title="Guides" description="Plain-language explainers.">
        <ul className="grid gap-2 sm:grid-cols-2">
          {GUIDES.map((guide) => (
            <li key={guide.slug} className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">
              <Link href={`/guides/${guide.slug}`} className="font-semibold">
                {guide.title}
              </Link>
              <p className="mt-1 text-ink-muted">{guide.summary}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
