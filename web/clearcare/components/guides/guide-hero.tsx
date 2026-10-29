// components/guides/guide-hero.tsx
// The top of a guide, flush under the site header like the home page's carousel: the guide's
// title on a panel of the soft welcome colours whose slanted edge cuts into the guide's photo, the same photo
// as its card on the resources page. On phones the panel sits under the photo. The words are never
// over the photo, so it is the same in the adult-centred design.
import Image from "next/image";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DraftLabel, guideTrail } from "@/components/guides/guide-header";
import type { Guide } from "@/lib/guides";
import { fullWidthClass } from "@/components/ui/classes";
import { Suspense } from "react";
import { ReturnLink } from "@/components/guides/return-link";

export function GuideHero({ guide }: { guide: Guide }) {
  return (
    <>
      <header className={`${fullWidthClass} -mt-6 md:-mt-10`}>
        {/* Kept short (CCARE-164: less scrolling): half photo and half words, like the home page's
          carousel, and a shallow photo on phones. The words' panel sets the height, at least 18rem
          (22rem from lg), so a long title and summary make it taller rather than overflow. */}
        <div className="relative flex flex-col md:block">
          <div className="relative aspect-[2/1] md:absolute md:inset-y-0 md:right-0 md:aspect-auto md:w-1/2">
            <Image
              src={guide.photo}
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className={`object-cover ${guide.photoFocus ?? "object-[50%_30%]"}`}
            />
          </div>
          <div className="welcome-band flex flex-col items-start justify-center gap-3 px-4 py-8 md:relative md:min-h-[18rem] md:w-[calc(50%+7rem)] md:py-8 lg:min-h-[22rem] md:pl-[max(2rem,calc((100vw-72rem)/2+2rem))] md:pr-32 md:[clip-path:polygon(0_0,100%_0,calc(100%-7rem)_100%,0_100%)]">
            <Breadcrumb trail={guideTrail(guide)} current={guide.title} />
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-ink lg:text-4xl">{guide.title}</h1>
            {guide.status === "draft" && <DraftLabel />}
            <p className="text-ink-muted md:text-lg">{guide.summary}</p>
          </div>
        </div>
      </header>

      {/* The way back to How to navigate ClearCare, when the guide was opened from it. */}
      <Suspense fallback={null}>
        <ReturnLink />
      </Suspense>
    </>
  );
}
