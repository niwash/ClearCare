// components/guides/guide-ending.tsx
// The end of a guide, so nobody finishes one with nowhere to go: the other guides as small photo
// cards, then the contacts banner, flush with the footer. A guide that isn't written yet has no
// link and the dashed coming-soon look, as on the resources page.
import Image from "next/image";
import Link from "next/link";
import { ContactsBanner } from "@/components/layout/contacts-banner";
import { comingSoonClass } from "@/components/ui/classes";
import { GUIDES, type Guide } from "@/lib/guides";

export function GuideEnding({ current }: { current: Guide }) {
  const others = GUIDES.filter((guide) => guide.slug !== current.slug);

  return (
    <>
      {/* A tinted band the full width of the window, like the home page's welcome, so the other
          guides stand apart from the end of this one. The negative bottom margin cancels the page's
          gap between sections (app/(site)/layout.tsx), so the band meets the contacts banner. */}
      <section
        aria-labelledby="other-guides-h"
        className="mx-[calc(50%-50vw)] -mb-8 w-screen bg-band py-10 md:-mb-12 md:py-14"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 md:px-8">
          <h2 id="other-guides-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Other guides
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((guide) => (
              <OtherGuideCard key={guide.slug} guide={guide} />
            ))}
          </ul>
        </div>
      </section>

      {/* The negative bottom margin cancels the page's padding, so it meets the footer. */}
      <ContactsBanner className="-mb-6 md:-mb-10" />
    </>
  );
}

export function OtherGuideCard({ guide }: { guide: Guide }) {
  const comingSoon = guide.status === "coming-soon";

  return (
    <li
      className={`relative flex flex-col overflow-hidden rounded-lg ${
        comingSoon ? comingSoonClass : "border border-line bg-surface hover:border-primary"
      }`}
    >
      <div className="relative aspect-[3/2]">
        <Image src={guide.photo} alt="" fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover object-[50%_30%]" />
      </div>
      <div className="flex flex-col gap-1 p-4">
        <h3 className="font-semibold text-ink">
          {comingSoon ? (
            `${guide.title} (coming soon)`
          ) : (
            // The whole card is the link (WCAG 2.5.5): the title's link stretches over it.
            <Link href={`/guides/${guide.slug}`} className="text-ink after:absolute after:inset-0 after:rounded-lg">
              {guide.title}
            </Link>
          )}
        </h3>
        <p className="text-sm text-ink-muted">{guide.summary}</p>
      </div>
    </li>
  );
}
