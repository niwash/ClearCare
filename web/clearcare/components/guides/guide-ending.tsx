// components/guides/guide-ending.tsx
// The end of a guide, so nobody finishes one with nowhere to go: the way back to How to navigate
// ClearCare when the guide was opened from it, the other guides as small photo cards, then the
// contacts banner, flush with the footer. A guide that isn't written yet has no
// link and the dashed coming-soon look, as on the resources page. The centre page uses the same
// band of guide cards.
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ReturnLink } from "@/components/guides/return-link";
import { ContactsBanner } from "@/components/layout/contacts-banner";
import { comingSoonClass, fullWidthClass, linkCardClass } from "@/components/ui/classes";
import { GUIDES, type Guide } from "@/lib/guides";

export function GuideEnding({ current }: { current: Guide }) {
  const others = GUIDES.filter((guide) => guide.slug !== current.slug);

  return (
    <>
      <Suspense fallback={null}>
        <ReturnLink />
      </Suspense>

      <GuidesBand id="other-guides-h" title="Other guides" guides={others} />

      {/* The negative bottom margin cancels the page's padding, so it meets the footer. */}
      <ContactsBanner className="-mb-6 md:-mb-10" />
    </>
  );
}

type GuidesBandProps = {
  id: string; // the heading's id, which labels the section
  title: string;
  intro?: string;
  guides: readonly Guide[];
  className?: string; // its bottom margin, for what comes after it
};

// Guides as small photo cards on a tinted band the full width of the window, like the home page's
// welcome, so they stand apart from the page above. The default negative bottom margin cancels the
// page's gap between sections (app/(site)/layout.tsx), so the band meets the contacts banner after it.
export function GuidesBand({ id, title, intro, guides, className = "-mb-6 md:-mb-8" }: GuidesBandProps) {
  return (
    <section aria-labelledby={id} className={`${fullWidthClass} bg-band py-8 md:py-10 ${className}`}>
      {/* The same width and side padding as the page's column, so the cards line up with it. */}
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 md:px-8">
        <div className="flex max-w-3xl flex-col gap-2">
          <h2 id={id} className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {title}
          </h2>
          {intro && <p className="text-ink-muted md:text-lg">{intro}</p>}
        </div>
        {/* Three cards fill a row of three; any other number goes four to a row. */}
        <ul className={`grid gap-3 sm:grid-cols-2 md:gap-4 ${guides.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          {guides.map((guide) => (
            <OtherGuideCard key={guide.slug} guide={guide} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function OtherGuideCard({ guide }: { guide: Guide }) {
  const comingSoon = guide.status === "coming-soon";

  return (
    <li
      className={`relative flex overflow-hidden sm:flex-col ${comingSoon ? `rounded-lg ${comingSoonClass}` : linkCardClass}`}
    >
      {/* A small square beside the words on phones, a shallow photo above them from sm up, so the
          band stays short (CCARE-164). */}
      <div className="relative w-24 shrink-0 sm:aspect-[2/1] sm:w-auto">
        <Image
          src={guide.photo}
          alt=""
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 6rem"
          // A slow, slight zoom as the card lifts (linkCardClass); not for reduced motion or the
          // adult-centred design.
          className={`object-cover transition-transform duration-700 motion-safe:group-hover:scale-105 adult:transition-none adult:group-hover:scale-100 ${guide.photoFocus ?? "object-[50%_30%]"}`}
        />
      </div>
      <div className="flex flex-col gap-1 p-4">
        <h3 className="font-semibold text-ink">
          {comingSoon ? (
            `${guide.title} (coming soon)`
          ) : (
            // The whole card is the link (WCAG 2.5.5): the title's link stretches over it.
            <Link href={`/guides/${guide.slug}`} className="text-ink after:absolute after:inset-0">
              {guide.title}
            </Link>
          )}
        </h3>
        <p className="text-sm text-ink-muted">{guide.summary}</p>
      </div>
    </li>
  );
}
