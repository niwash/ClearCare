// components/home/not-alone.tsx
// Reassurance for someone facing the choice, beside a photo: who they can turn to, with a way to
// the contacts page (CCARE-179). The organisations named are all on that page. The photo, of a
// mother and daughter holding hands as they talk, is its own, free to use without credit (Pexels
// licence), downloaded at 1600px wide:
// support.jpg  Danik Prihodko, https://www.pexels.com/photo/mother-and-daughter-sitting-at-the-table-and-holding-hands-17066491/
// It only sets the mood, so its alt text is empty; the words carry the meaning.
//
// A band the full width of the window, split like the carousel's slides: from tablet width the
// photo fills the left half, edge to edge and the band's full height, and the words sit on the
// right on a fade from the warm band colour to the soft blue, lined up with the page's column. On
// phones the photo sits above the words. The adult-centred design turns the fade to its band colour.
import Image from "next/image";
import Link from "next/link";
import { actionLinkClass, fullWidthClass } from "@/components/ui/classes";

export function NotAlone() {
  return (
    // The negative bottom margin cancels the page's gap, so it meets the figures' band below.
    <section
      aria-labelledby="not-alone-h"
      className={`${fullWidthClass} -mb-6 grid bg-linear-to-br from-warm to-tint-blue md:-mb-8 md:grid-cols-2`}
    >
      {/* The words' column sets the band's height, at least 28rem, and the photo fills it. */}
      <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[28rem]">
        <Image
          src="/home/support.jpg"
          alt=""
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          // A portrait photo cut through the middle: both faces and their joined hands.
          className="object-cover object-[50%_45%]"
        />
      </div>
      {/* The right-hand padding matches the page's column (max-w-6xl, md:px-8), so the words end
          where the sections above and below do. */}
      <div className="reveal flex flex-col items-start justify-center gap-4 px-4 py-10 md:py-14 md:pl-12 md:pr-[max(2rem,calc((100vw-72rem)/2+2rem))] lg:pl-16">
        <h2 id="not-alone-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          You&apos;re not alone in this
        </h2>
        <span aria-hidden className="h-1 w-12 rounded-full bg-accent" />
        <p className="text-ink-muted md:text-lg">
          Questions come up at every step, about Fair Deal, a home you&apos;re worried about, or how to support the
          person moving. You don&apos;t have to find the answers on your own: your local Nursing Homes Support Office,
          Citizens Information, HIQA and support groups such as Sage Advocacy and ALONE are there to help.
        </p>
        <Link href="/contacts" className={actionLinkClass}>
          See who to contact <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
