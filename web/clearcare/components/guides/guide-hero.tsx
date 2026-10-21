// components/guides/guide-hero.tsx
// The top of a guide, flush under the site header like the home page's carousel: the guide's
// title on a panel of brand colour whose slanted edge cuts into the guide's photo, the same photo
// as its card on the resources page. On phones the panel sits under the photo. The words are never
// over the photo, so it is the same in the adult-centred design.
import Image from "next/image";
import Link from "next/link";
import { DraftLabel } from "@/components/guides/guide-header";
import type { Guide } from "@/lib/guides";
import { fullWidthClass } from "@/components/ui/classes";

export function GuideHero({ guide }: { guide: Guide }) {
  return (
    <header className={`${fullWidthClass} -mt-6 md:-mt-10`}>
      <div className="relative flex flex-col md:block md:h-[24rem] lg:h-[28rem]">
        <div className="relative aspect-[3/2] md:absolute md:inset-y-0 md:right-0 md:aspect-auto md:w-[60%]">
          <Image
            src={guide.photo}
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 60vw, 100vw"
            className="object-cover object-[50%_30%]"
          />
        </div>
        <div className="brand-band flex flex-col items-start justify-center gap-3 px-4 py-8 md:absolute md:inset-y-0 md:left-0 md:w-[52%] md:py-10 md:pl-[max(2rem,calc((100vw-72rem)/2+2rem))] md:pr-32 md:[clip-path:polygon(0_0,100%_0,calc(100%-7rem)_100%,0_100%)]">
          <Link href="/resources" className="text-sm text-ink tap-target">
            ← Back to resources
          </Link>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-4xl lg:text-5xl">
            {guide.title}
          </h1>
          {guide.status === "draft" && <DraftLabel />}
          <p className="text-ink-muted md:text-lg">{guide.summary}</p>
        </div>
      </div>
    </header>
  );
}
