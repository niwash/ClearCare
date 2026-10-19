import type { Metadata } from "next";
import Link from "next/link";
import { DraftLabel } from "@/components/guides/guide-header";
import { Section } from "@/components/layout/section";
import { comingSoonClass } from "@/components/ui/classes";
import { GUIDES, type Guide } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Resources · ClearCare",
  description: "Guides to choosing and paying for a nursing home in Ireland.",
};

type OfficialLink = {
  title: string;
  publisher: string;
  summary: string;
  href: string;
};

// Checked 19 Oct 2026.
const OFFICIAL_LINKS: OfficialLink[] = [
  {
    title: "Fair Deal scheme",
    publisher: "HSE",
    summary: "Applying, assessments and costs.",
    href: "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/",
  },
  {
    title: "Finding the right nursing home",
    publisher: "HSE",
    summary: "Researching homes, costs and inspection reports.",
    href: "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/finding-the-right-nursing-home/",
  },
  {
    title: "Moving from home to long-term care",
    publisher: "Citizens Information",
    summary: "Your options when moving into care.",
    href: "https://www.citizensinformation.ie/en/health/health-services/health-services-for-older-people/moving-from-home-to-long-term-care/",
  },
  {
    title: "Moving into a nursing home",
    publisher: "Competition and Consumer Protection Commission",
    summary: "Choosing a home, managing money, your rights and how to complain.",
    href: "https://www.ccpc.ie/manage-your-money/planning-for-the-future/how-to-plan-for-the-future/moving-into-a-nursing-home",
  },
  {
    // HIQA's national standards page still lists the 2016 standards as current (checked 19 Oct 2026).
    title: "Your guide to the National Standards, 2016 (PDF)",
    publisher: "HIQA",
    summary: "What good care in a nursing home looks like. Published in 2016, and still the current standards.",
    href: "https://www.hiqa.ie/sites/default/files/2017-01/National-Standards-for-Older-People-Guide.pdf",
  },
];

// The whole card is the link (WCAG 2.5.5): the title's link stretches over it.
const cardClass = "relative flex flex-col gap-1 rounded-lg border border-line bg-surface px-4 py-3 text-sm hover:border-primary";
const stretchedLinkClass = "after:absolute after:inset-0 after:rounded-lg";

export default function ResourcesPage() {
  return (
    <>
      <div className="flex max-w-3xl flex-col gap-3">
        <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-5xl">Resources</h1>
        <p className="text-ink-muted md:text-lg">
          Help with choosing and paying for a nursing home. For who to call, see <Link href="/contacts">Contacts</Link>.
        </p>
      </div>

      <div className="flex max-w-4xl flex-col gap-8 md:gap-12">
        <Section title="Guides">
          <ul className="grid gap-3 sm:grid-cols-2">
            {GUIDES.map((guide) => (
              <GuideCard key={guide.slug} guide={guide} />
            ))}
          </ul>
        </Section>

        <Section title="Official Information">
          <ul className="grid gap-3 sm:grid-cols-2">
            {OFFICIAL_LINKS.map((link) => (
              <li key={link.href} className={cardClass}>
                <p className="text-xs text-ink-muted">{link.publisher}</p>
                <h3 className="font-semibold">
                  <a href={link.href} className={stretchedLinkClass} target="_blank" rel="noopener noreferrer">
                    {link.title}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </h3>
                <p className="text-ink-muted">{link.summary}</p>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}

// A guide that isn't written yet has no link, and the same dashed look as other unfinished features.
function GuideCard({ guide }: { guide: Guide }) {
  if (guide.status === "coming-soon") {
    return (
      <li className={`flex flex-col gap-1 px-4 py-3 text-sm ${comingSoonClass}`}>
        <h3 className="font-semibold">{guide.title} (coming soon)</h3>
        <p>{guide.summary}</p>
      </li>
    );
  }

  return (
    <li className={cardClass}>
      <h3 className="font-semibold">
        <Link href={`/guides/${guide.slug}`} className={stretchedLinkClass}>
          {guide.title}
        </Link>
      </h3>
      {guide.status === "draft" && <DraftLabel />}
      <p className="text-ink-muted">{guide.summary}</p>
    </li>
  );
}
