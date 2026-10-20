import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DraftLabel } from "@/components/guides/guide-header";
import { comingSoonClass } from "@/components/ui/classes";
import { GUIDES, type Guide, type GuideSlug } from "@/lib/guides";

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

// One photo per guide: the home page's (credits in components/home/feature-carousel.tsx), and
// navigate.jpg  Andrea Piacquadio, https://www.pexels.com/photo/cheerful-senior-mother-and-adult-daughter-using-smartphone-together-3791664/
// They only set the mood, so their alt text is empty.
const GUIDE_PHOTOS: Record<GuideSlug, string> = {
  "user-journey": "/home/family.jpg",
  "choosing-a-nursing-home": "/home/phone.jpg",
  "reading-inspection-reports": "/home/report.jpg",
  "fair-deal": "/home/fair-deal.jpg",
  "using-clearcare": "/resources/navigate.jpg",
};

// Full-width bands break out of the page's column and padding, as on the home page.
const fullWidthClass = "mx-[calc(50%-50vw)] w-screen";

const buttonClass =
  "inline-flex h-12 items-center gap-2 rounded-md bg-primary px-5 font-semibold text-on-primary no-underline hover:bg-primary-hover hover:text-on-primary";

export default function ResourcesPage() {
  return (
    <>
      <ResourcesHero />

      <section aria-labelledby="guides-h" className="flex flex-col gap-6">
        <div className="flex max-w-3xl flex-col gap-2">
          <h2 id="guides-h" className="font-heading text-2xl font-semibold tracking-tight md:text-4xl">
            Our Guides
          </h2>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 md:gap-6">
          {GUIDES.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} />
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
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-10 md:px-8 md:py-16">
        <h1 id="resources-h" className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-5xl">
          Resources
        </h1>
        <p className="max-w-2xl text-ink-muted md:text-lg">
          Help at every step, from the first conversation to moving in by starting with 
          our guides.
        </p>
      </div>
    </section>
  );
}

// A photo card per guide, like the home page's. The whole card is the link, through the button
// stretched over it. A guide that isn't written yet has no link, a "Coming soon" label in place of
// the button, and the dashed look of other unfinished features.
function GuideCard({ guide }: { guide: Guide }) {
  const comingSoon = guide.status === "coming-soon";

  return (
    <li
      className={`relative flex flex-col overflow-hidden rounded-lg ${
        comingSoon ? comingSoonClass : "border border-line bg-surface"
      }`}
    >
      <div className="relative aspect-[3/2]">
        <Image src={GUIDE_PHOTOS[guide.slug as GuideSlug]} alt="" fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover object-[50%_30%]" />
      </div>
      <div className="flex flex-1 flex-col items-start gap-2 p-5 md:p-6">
        <h3 className="font-heading text-xl font-semibold text-ink md:text-2xl">{guide.title}</h3>
        {guide.status === "draft" && <DraftLabel />}
        <p className="flex-1 text-ink-muted md:text-lg">{guide.summary}</p>
        {comingSoon ? (
          <span className={`mt-2 inline-flex h-12 items-center px-5 font-semibold ${comingSoonClass}`}>Coming soon</span>
        ) : (
          <Link href={`/guides/${guide.slug}`} className={`${buttonClass} mt-2 after:absolute after:inset-0`}>
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
      className={`${fullWidthClass} bg-band -mb-6 -mt-8 py-10 md:-mb-10 md:-mt-12 md:py-16`}
    >
      {/* The same width and side padding as the page's column, so the cards line up with it. */}
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 md:px-8">
        <div className="flex max-w-3xl flex-col gap-2">
          <h2 id="official-h" className="font-heading text-2xl font-semibold tracking-tight md:text-4xl">
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
              // isolate: the watermark's -z-10 then sits above the card's background but below its words.
              <li
                key={link.href}
                className="relative isolate flex min-h-64 flex-col items-start gap-2 overflow-hidden rounded-lg border border-line bg-surface p-5 hover:border-primary"
              >
                <LogoWatermark publisher={link.publisher} />
                <span className="rounded-md bg-band px-2.5 py-1 text-xs font-semibold text-ink">{link.publisher}</span>
                <h3 className="font-semibold md:text-lg">{link.title}</h3>
                <p className="text-ink-muted">{link.summary}</p>
                {/* mt-auto: the buttons line up along the bottom of each row of cards. */}
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${buttonClass} mt-auto after:absolute after:inset-0 after:rounded-lg`}
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

// The end of the page, a band of brand colour like the home page's news: where to turn for a
// person to talk to. After the guides, and straight above the official information band.
function ContactsBanner() {
  return (
    <section
      aria-labelledby="contacts-h"
      className={`${fullWidthClass} brand-band`}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-8 md:py-14">
        <div className="flex max-w-2xl flex-col gap-2">
          <h2 id="contacts-h" className="font-heading text-2xl font-semibold text-ink md:text-4xl">
            Need to talk to someone?
          </h2>
          <p className="text-ink-muted md:text-lg">
            Our contacts page lists who to call about nursing home care: the regulator, the Fair Deal offices,
            complaints and advocacy.
          </p>
        </div>
        <Link href="/contacts" className={`${buttonClass} shrink-0`}>
          See contacts <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}

// Each publisher's logo, from its own website (checked 20 Oct 2026). Citizens Information's is the
// Citizens Information Board's, which runs it. They only identify who publishes each link; the
// section says the publishers don't endorse ClearCare. A logo with colours of its own is shown as
// it is; one in a single colour (the HSE's has none set, Citizens Information's is white, for dark
// backgrounds) is drawn as a mask in the publisher's colour, as on its own website.
type PublisherLogo = { src: string; colour?: string };

const PUBLISHER_LOGOS: Record<string, PublisherLogo> = {
  HSE: { src: "/resources/logos/hse.svg", colour: "#02594c" },
  "Citizens Information": { src: "/resources/logos/citizens-information.png", colour: "#007cb6" },
  "Competition and Consumer Protection Commission": { src: "/resources/logos/ccpc.png" },
  HIQA: { src: "/resources/logos/hiqa.svg" },
};

// The publisher's logo, large and faded in the card's corner. Decorative: the publisher is named
// in words above the title. Not in the adult-centred design, which keeps patterns and pictures out
// from behind text.
function LogoWatermark({ publisher }: { publisher: string }) {
  const logo = PUBLISHER_LOGOS[publisher];
  if (!logo) return null;
  // Sized to the space beside the button in the card's bottom-right corner, so it never sits
  // behind words.
  // logo-watermark (globals.css) brightens it in dark mode.
  const place = "logo-watermark pointer-events-none absolute bottom-5 right-4 -z-10 h-12 w-32 opacity-40 adult:hidden";

  if (logo.colour) {
    const mask = { maskImage: `url(${logo.src})`, WebkitMaskImage: `url(${logo.src})`, backgroundColor: logo.colour };
    return (
      <span
        aria-hidden
        style={mask}
        className={`${place} [mask-position:right_bottom] [mask-repeat:no-repeat] [mask-size:contain]`}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small decorative logo; no resizing needed
    <img src={logo.src} alt="" aria-hidden className={`${place} object-contain object-right-bottom`} />
  );
}

function ExternalIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}
