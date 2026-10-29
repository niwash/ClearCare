// components/home/not-alone.tsx
// Reassurance for someone facing the choice, beside a photo: who they can turn to, with a way to
// the contacts page (CCARE-179). The organisations named are all on that page. The photo is the
// resources page's, credited in lib/guides.ts; the carousel above has the home page's own. It
// only sets the mood, so its alt text is empty; the words carry the meaning.
import Image from "next/image";
import Link from "next/link";

export function NotAlone() {
  return (
    <section aria-labelledby="not-alone-h" className="grid items-center gap-8 md:grid-cols-[1fr_1fr] md:gap-12">
      <Image
        src="/resources/navigate.jpg"
        alt=""
        width={1600}
        height={1067}
        sizes="(min-width: 1152px) 552px, (min-width: 768px) 50vw, 100vw"
        className="aspect-[4/3] w-full rounded-2xl object-cover"
      />
      <div className="flex flex-col items-start gap-4">
        <h2 id="not-alone-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          You&apos;re not alone in this
        </h2>
        <span aria-hidden className="h-1 w-12 rounded-full bg-on-tint-sage" />
        <p className="text-ink-muted md:text-lg">
          Questions come up at every step, about Fair Deal, a home you&apos;re worried about, or how to support the
          person moving. You don&apos;t have to find the answers on your own: your local Nursing Homes Support Office,
          Citizens Information, HIQA and support groups such as Sage Advocacy and ALONE are there to help.
        </p>
        <Link
          href="/contacts"
          className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-5 font-semibold text-on-primary no-underline hover:bg-primary-hover hover:text-on-primary"
        >
          See who to contact <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
