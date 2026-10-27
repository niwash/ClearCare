"use client";
// components/home/feature-carousel.tsx
// What the site does, one photo card per task. In the standard design it is a carousel that only
// moves when asked: the arrows on it, the dots under it, swipe or scroll. In the adult-centred
// design the same list is a grid with nothing hidden or moving, so the switch is CSS only.
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DraftLabel } from "@/components/guides/guide-header";
import { comingSoonClass, fullWidthClass } from "@/components/ui/classes";
import { getGuide, type Guide } from "@/lib/guides";

type Feature = {
  title: string;
  text: string;
  href: string;
  action: string; // the button's words: what it opens, not just "See more"
  guide?: Guide; // for its draft or coming-soon status
  photo: string;
  // Which part of the photo to keep when it's cropped, written out in full for Tailwind. The default
  // keeps faces, about a third of the way down.
  focus?: string;
};

// Photos are free to use without credit (Unsplash and Pexels licences), downloaded at 1600px wide:
// report.jpg     SHVETS production, https://www.pexels.com/photo/elderly-woman-reading-a-document-7545330/
// family.jpg     Kampus Production, https://www.pexels.com/photo/a-woman-and-an-elderly-man-in-the-living-room-7551665/
// fair-deal.jpg  Kampus Production, https://www.pexels.com/photo/elderly-couple-sitting-at-the-table-with-documents-and-using-a-smartphone-7477702/
// phone.jpg      Karolina Grabowska (kaboompics.com), https://www.pexels.com/photo/serious-lady-talking-on-smartphone-and-taking-notes-on-paper-4491477/
// They only set the mood, so their alt text is empty; the card's words carry the meaning.
const FEATURES: Feature[] = [
  {
    title: "How choosing a home works",
    text: "From the first conversation to moving in.",
    href: "/guides/how-a-family-chooses",
    action: "See the steps",
    guide: getGuide("how-a-family-chooses"),
    photo: "/home/family.jpg",
  },
  {
    title: "Fair Deal explained",
    text: "How the HSE helps pay for nursing home care.",
    href: "/guides/fair-deal",
    action: "Learn about Fair Deal",
    guide: getGuide("fair-deal"),
    photo: "/home/fair-deal.jpg",
  },
  {
    title: "What to ask when you visit",
    text: "Questions to ask a home before you decide.",
    href: "/guides/choosing-a-nursing-home",
    action: "See the questions",
    guide: getGuide("choosing-a-nursing-home"),
    photo: "/home/phone.jpg",
    // The woman taking notes is on the right and low down; this keeps her hand and the paper in view
    // and leaves the computer on the left, with its logo, mostly under the text panel.
    focus: "object-[70%_75%]",
  },
  // Last, so the carousel opens on the guides; the search box is also further down the page.
  {
    title: "Check a nursing home's record",
    text: "Every HIQA inspection report, one page per home.",
    href: "/search",
    action: "Search for a home",
    photo: "/home/report.jpg",
  },
];

// On phones the slide is a photo above a text panel, so the arrows sit at the middle of the photo,
// not of the whole slide, where they would cover the heading. The photo is 3:2 and as wide as the
// slide: 88% of the list's width (the viewport less its 1rem padding each side), all of it from sm.
const arrowClass =
  "absolute top-[calc((100vw_-_2rem)*0.88/3)] sm:top-[calc((100vw_-_2rem)/3)] md:top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-ink shadow-md hover:border-primary md:size-12 adult:hidden";

export function FeatureCarousel() {
  const listRef = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  // The list is the offset parent of its items (it is relative), so offsetLeft is the scroll position.
  // Smooth scrolling comes from the list's CSS, which turns it off for reduced motion. The arrows
  // wrap round at the ends, so they never disappear from under the pointer or the keyboard focus.
  function goTo(index: number) {
    const wrapped = (index + FEATURES.length) % FEATURES.length;
    const item = listRef.current?.children[wrapped] as HTMLElement | undefined;
    if (!item) return;
    // Set at once too, not only from the scroll events (which onScroll then follows), so the
    // carousel knows where it is going even where scroll events are slow to arrive.
    setCurrent(wrapped);
    listRef.current!.scrollTo({ left: item.offsetLeft });
  }

  // Swiping or scrolling moves the list directly, so the current slide is read back from it, but
  // only once the scroll settles. Read on every scroll event, the dots would flick through each
  // slide passed on the way, and back to the old one first, after an arrow or dot sets the target.
  function onScroll() {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(readCurrent, 100);
  }

  function readCurrent() {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.children) as HTMLElement[];
    const nearest = items.reduce(
      (best, item, index) =>
        Math.abs(item.offsetLeft - list.scrollLeft) < Math.abs(items[best].offsetLeft - list.scrollLeft) ? index : best,
      0,
    );
    setCurrent(nearest);
  }

  return (
    // The carousel runs the full width of the window, flush under the header, out of the page's
    // column and padding. The grid stays in the column.
    <section
      aria-labelledby="features-h"
      className={`${fullWidthClass} -mt-6 flex flex-col gap-3 md:-mt-10 adult:mx-0 adult:mt-0 adult:w-auto`}
    >
      {/* A carousel at the top of the page needs no visible heading; the grid gets one. */}
      <h2 id="features-h" className="sr-only font-heading text-xl font-semibold adult:not-sr-only md:text-2xl">
        What you can do here
      </h2>

      <div className="relative">
        <ul
          ref={listRef}
          onScroll={onScroll}
          className="relative flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto scroll-smooth px-4 [scrollbar-width:none] motion-reduce:scroll-auto md:scroll-px-0 md:gap-0 md:px-0 adult:grid adult:snap-none adult:overflow-visible adult:px-0 sm:adult:grid-cols-2 md:adult:gap-4"
        >
          {FEATURES.map((feature, index) => (
            <li key={feature.href} className="w-[88%] shrink-0 snap-start sm:w-full adult:w-full">
              {/* The first slide's photo is the largest thing on the page, so it loads first. */}
              <FeatureCard feature={feature} priority={index === 0} />
            </li>
          ))}
        </ul>

        <button type="button" onClick={() => goTo(current - 1)} aria-label="Previous slide" className={`${arrowClass} left-2 md:left-6`}>
          <Chevron direction="left" />
        </button>
        <button type="button" onClick={() => goTo(current + 1)} aria-label="Next slide" className={`${arrowClass} right-2 md:right-6`}>
          <Chevron direction="right" />
        </button>

        {/* Which slide is showing. Each dot is a 24px target (WCAG 2.5.8) around a small circle.
            Under the cards on phones; on wider screens, on a pill over the bottom of the band, so
            the band meets the section below with no strip between them. */}
        <div className="flex justify-center pt-3 md:absolute md:inset-x-0 md:bottom-5 md:pt-0 adult:hidden">
          <div className="flex gap-1 md:rounded-full md:bg-surface md:px-2 md:shadow-md">
            {FEATURES.map((feature, index) => (
              <button
                key={feature.href}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Slide ${index + 1} of ${FEATURES.length}: ${feature.title}`}
                aria-current={index === current}
                className="group grid size-6 place-items-center"
              >
                <span className="size-2.5 rounded-full border-2 border-ink-muted group-hover:border-primary group-aria-[current=true]:border-primary group-aria-[current=true]:bg-primary" />
              </button>
            ))}
          </div>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        Slide {current + 1} of {FEATURES.length}
      </p>
    </section>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

// In the carousel, on tablets and up, each slide is split: the words on a panel of brand colour
// on the left, whose slanted edge cuts into the photo on the right. The photo fills only about
// 60% of the band, close to its own 3:2 shape, so little of it is cropped. On phones the panel
// sits under the photo. In the grid the card keeps the page's colours, with the words under the
// photo, as the adult-centred design keeps photos out from behind text.
//
// The whole slide is the link, through its button stretched over it. It is styled as a card, not as
// a link: a deliberate exception to the design guide's rule that links are underlined. The focus
// outline (globals.css) still shows for keyboard users. A guide that isn't written yet has no link,
// a "Coming soon" label in place of the button, and in the grid the dashed coming-soon look.
function FeatureCard({ feature, priority = false }: { feature: Feature; priority?: boolean }) {
  const comingSoon = feature.guide?.status === "coming-soon";

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-lg md:block md:h-[24rem] md:rounded-none lg:h-[26rem] adult:flex adult:h-full adult:rounded-lg ${
        comingSoon
          ? "adult:cursor-not-allowed adult:border-2 adult:border-dashed adult:border-field adult:bg-surface-muted"
          : "adult:border adult:border-line adult:bg-surface"
      }`}
    >
      {/* Half the slide each, text and photo. The text panel's slanted edge overlaps the photo by 7rem. */}
      <div className="relative aspect-[3/2] shrink-0 md:absolute md:inset-y-0 md:right-0 md:aspect-auto md:w-1/2 adult:relative adult:aspect-[3/2] adult:w-auto">
        <Image
          src={feature.photo}
          alt=""
          fill
          priority={priority}
          sizes="(min-width: 768px) 60vw, 90vw"
          className={`object-cover ${feature.focus ?? "object-[50%_30%]"}`}
        />
      </div>

      <div className="feature-panel flex flex-1 flex-col items-start gap-3 p-5 md:absolute md:inset-y-0 md:left-0 md:right-[calc(50%-7rem)] md:justify-center md:py-10 md:pl-[max(6rem,calc((100vw-72rem)/2+2rem))] md:pr-32 md:[clip-path:polygon(0_0,100%_0,calc(100%-7rem)_100%,0_100%)] adult:static adult:w-auto adult:justify-start adult:p-5 adult:[clip-path:none]">
        <h3 className="font-heading text-xl font-semibold text-ink md:text-2xl lg:text-3xl adult:text-lg">
          {feature.title}
        </h3>
        {feature.guide?.status === "draft" && <DraftLabel />}
        <p className="text-ink-muted md:text-lg adult:text-base">{feature.text}</p>
        {comingSoon ? (
          <span className={`mt-1 inline-flex h-12 items-center px-5 font-semibold ${comingSoonClass}`}>Coming soon</span>
        ) : (
          <Link
            href={feature.href}
            className="mt-1 inline-flex h-12 items-center gap-2 rounded-md bg-primary px-5 font-semibold text-on-primary no-underline after:absolute after:inset-0 hover:bg-primary-hover hover:text-on-primary"
          >
            {feature.action}<span className="sr-only">: {feature.title}</span>
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </article>
  );
}
