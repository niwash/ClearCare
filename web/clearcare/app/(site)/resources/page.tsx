import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DraftLabel } from "@/components/guides/guide-header";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ContactsBanner } from "@/components/layout/contacts-banner";
import { actionLinkClass, comingSoonClass, fullWidthClass } from "@/components/ui/classes";
import { ExternalIcon } from "@/components/ui/external-icon";
import { OrganisationIcon, type OrganisationKind } from "@/components/ui/organisation-icon";
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

// The kind of each publisher, for its generic icon (components/ui/organisation-icon.tsx).
const PUBLISHER_KINDS: Record<string, OrganisationKind> = {
  HSE: "public-body",
  "Citizens Information": "public-body",
  "Competition and Consumer Protection Commission": "public-body",
  HIQA: "regulator",
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


export default function ResourcesPage() {
  return (
    <>
      <ResourcesHero />

      <section aria-labelledby="guides-h" className="flex flex-col gap-6">
        <div className="flex max-w-3xl flex-col gap-2">
          <h2 id="guides-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Our Guides
          </h2>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {GUIDES.map((guide, index) => (
            // The first card's photo is the largest thing near the top of the page, so it loads first.
            <GuideCard key={guide.slug} guide={guide} priority={index === 0} />
          ))}
        </ul>
      </section>

      <ContactsBanner />

      <OfficialInformation />
    </>
  );
}

// The top of the page, flush under the header like the home page's carousel: the heading and a
// line of welcome on a band of brand colour (brand-band, globals.css).
function ResourcesHero() {
  return (
    <section aria-labelledby="resources-h" className={`${fullWidthClass} brand-band -mt-6 md:-mt-10`}>
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-6 md:px-8 md:py-8">
        <Breadcrumb trail={[]} current="Resources" />
        <h1 id="resources-h" className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Resources
        </h1>
        <p className="max-w-2xl text-ink-muted md:text-lg">
          Help at every step, from the first conversation to moving in. Start with our guides.
        </p>
      </div>
    </section>
  );
}

// A photo card per guide, like the home page's. The whole card is the link, through "Read guide"
// stretched over it. Kept short (CCARE-164: less scrolling): on phones a row with a small square
// photo beside the words; from sm up a card with a wide, shallow photo, three to a row from lg. A
// guide that isn't written yet has no link, "Coming soon" in its place, and the dashed look of
// other unfinished features.
function GuideCard({ guide, priority = false }: { guide: Guide; priority?: boolean }) {
  const comingSoon = guide.status === "coming-soon";

  return (
    <li
      className={`relative flex overflow-hidden rounded-lg sm:flex-col ${
        comingSoon ? comingSoonClass : "border border-line bg-surface hover:border-primary"
      }`}
    >
      <div className="relative w-28 shrink-0 sm:aspect-[2/1] sm:w-auto">
        <Image
          src={guide.photo}
          alt=""
          fill
          priority={priority}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 7rem"
          className={`object-cover ${guide.photoFocus ?? "object-[50%_30%]"}`}
        />
      </div>
      <div className="flex flex-1 flex-col items-start gap-1.5 p-4 md:p-5">
        <h3 className="font-heading text-lg font-semibold text-ink md:text-xl">{guide.title}</h3>
        {guide.status === "draft" && <DraftLabel />}
        <p className="flex-1 text-ink-muted">{guide.summary}</p>
        {comingSoon ? (
          <span className="mt-1 font-semibold text-ink-muted">Coming soon</span>
        ) : (
          <Link
            href={`/guides/${guide.slug}`}
            className="mt-1 inline-flex items-center gap-1.5 font-semibold no-underline after:absolute after:inset-0 hover:underline"
          >
            Read guide<span className="sr-only">: {guide.title}</span>
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </li>
  );
}

// The official sites, in a tinted band like the home page's welcome: who publishes each one, the
// title and summary, then a button that opens it in a new tab. The whole card is the link (WCAG
// 2.5.5): the button's link stretches over it.
function OfficialInformation() {
  return (
    // The negative margins cancel the page's gaps, so it meets the contacts banner above and the
    // footer below.
    <section
      aria-labelledby="official-h"
      className={`${fullWidthClass} bg-band -mb-6 -mt-6 py-8 md:-mb-10 md:-mt-8 md:py-12`}
    >
      {/* The same width and side padding as the page's column, so the cards line up with it. */}
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 md:px-8">
        <div className="flex max-w-3xl flex-col gap-2">
          <h2 id="official-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Official Information
          </h2>
          <p className="text-ink-muted md:text-lg">
            From the HSE, Citizens Information, the CCPC and HIQA.
          </p>
          <p className="text-sm text-ink-muted">
            These organisations do not endorse ClearCare.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {OFFICIAL_LINKS.map((link) => {
            const isPdf = link.href.toLowerCase().endsWith(".pdf");
            return (
              <li
                key={link.href}
                className="relative flex flex-col items-start gap-2 rounded-lg border border-line bg-surface p-5 hover:border-primary"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-ink">
                  <OrganisationIcon kind={PUBLISHER_KINDS[link.publisher] ?? "public-body"} />
                  {link.publisher}
                </span>
                <h3 className="font-semibold md:text-lg">{link.title}</h3>
                <p className="text-ink-muted">{link.summary}</p>
                {/* mt-auto: the buttons line up along the bottom of each row of cards. */}
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${actionLinkClass} mt-auto after:absolute after:inset-0 after:rounded-lg`}
                >
                  {isPdf ? "See Document" : "See Website"}
                  <span className="sr-only">
                    : {link.title}, {link.publisher} (opens in a new tab)
                  </span>
                  <ExternalIcon />
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
