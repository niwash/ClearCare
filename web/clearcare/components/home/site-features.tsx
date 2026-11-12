// components/home/site-features.tsx
// What a visitor can do on ClearCare, as six numbered steps in the order the guide to the site
// recommends them (app/(site)/guides/using-clearcare): read how choosing works, Fair Deal and the
// questions, then search, read a home's record and compare (CCARE-179, CCARE-232). Each step is a
// card that opens with a small picture of the page it leads to, so a newcomer sees what is there
// before choosing, and ends in a button to that page, stretched over the card so the whole card
// can be chosen. On the page's own background, as the hero's band sits just above.
//
// The pictures are drawn here from the site's own colours rather than taken as screenshots, so they
// follow dark mode and the adult-centred design and never go out of date with a page's layout. They
// are decoration (aria-hidden): the card's words say the same. What they show is the pages' own
// wording (the record's tabs, the guides' headings and questions), with grey bars where a home's
// name or a figure would be, as an invented one could be mistaken for a real one.
//
// Each card lifts on hover and its arrow moves on. The heading's bar draws out and the cards rise
// in one after another as they scroll into view (CCARE-186).
import Link from "next/link";
import type { ReactNode } from "react";
import { JudgementIcon } from "@/components/centre/judgement-icon";
import { StepNumber } from "@/components/guides/step-number";
import { linkCardClass, secondaryLinkClass, stretchedActionClass } from "@/components/ui/classes";
import { Icon } from "@/components/ui/icons";
import { CENTRE_SECTION_TITLES } from "@/lib/centre-record";

type Step = {
  title: string;
  text: string;
  href: string;
  action: string; // the button's words: what it opens
  picture: ReactNode;
  tint: string; // the picture's background, written out in full for Tailwind
};

// In the guide's order. Its "Call the home" has no page to open, so it is left to the guide; a
// home's record, which the guide reaches from the search, has a step of its own here.
const STEPS: Step[] = [
  {
    title: "Learn how choosing works",
    // No claim about what every family does: the guide's stages, as it describes them itself.
    text: "The stages of choosing a home, from the first conversation to moving in.",
    href: "/guides/how-a-family-chooses",
    action: "See the stages",
    picture: <ListPicture items={["Talk about what to do", "Apply for Fair Deal", "Find and visit homes"]} mark="number" />,
    tint: "bg-tint-sage",
  },
  {
    title: "Understand Fair Deal",
    text: "How the scheme helps pay for care, who can apply and what you will pay.",
    href: "/guides/fair-deal",
    action: "See how it works",
    picture: <ListPicture items={["Who can apply?", "How much will you pay?", "How to apply: step by step"]} mark="number" />,
    tint: "bg-tint-gold",
  },
  {
    title: "Know what to ask",
    text: "Questions to work through as a family, and to ask a home when you visit.",
    href: "/guides/choosing-a-nursing-home",
    action: "See the questions",
    picture: (
      <ListPicture
        items={["Do you know what level of care is needed?", "Do you know which area you want to search in?", "Do you know what amenities matter most?"]}
        mark="box"
      />
    ),
    tint: "bg-tint-rose",
  },
  {
    title: "Find homes near you",
    text: "Search by a home's name, a town, a county or an Eircode, and see the homes in a list and on a map.",
    href: "/search",
    action: "Search for a home",
    picture: <SearchPicture />,
    tint: "bg-tint-blue",
  },
  {
    title: "Read a home's record",
    text: "In plain words: what to look at first, what happened after each inspection, and what to ask.",
    href: "#example-h",
    action: "See an example",
    picture: <RecordPicture />,
    tint: "bg-tint-gold",
  },
  {
    title: "Compare homes side by side",
    text: "Shortlist homes, then see their cost, what they offer and their inspections in one table.",
    href: "/compare",
    action: "Compare homes",
    picture: <ComparePicture />,
    tint: "bg-tint-sage",
  },
];

// What the steps leave out, so everything in the menu can be reached from here.
const ELSEWHERE = [
  { href: "/resources", label: "Guides and resources" },
  { href: "/contacts", label: "Who to contact" },
  { href: "/national", label: "National figures" },
];

export function SiteFeatures() {
  return (
    <section aria-labelledby="help-h" className="flex flex-col gap-8 py-4 md:py-6">
      <div className="reveal flex flex-col items-center gap-3 text-center adult:items-start adult:text-left">
        <h2 id="help-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          What you can do on ClearCare
        </h2>
        <span aria-hidden className="reveal-bar h-1 w-12 origin-center rounded-full bg-accent" />
        <p className="max-w-2xl text-ink-muted md:text-lg">
          Six steps, in the order we suggest. Everything is free, with no account needed, so start wherever suits
          you.
        </p>
      </div>
      <ol className="reveal-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {STEPS.map((step, index) => (
          // relative: the button's stretched target fills the card.
          <li key={step.href} className={`${linkCardClass} relative flex min-w-0 flex-col overflow-hidden`}>
            {/* The picture: a fixed height, so the cards in a row line up; what doesn't fit is cut off
                at its foot, like a page seen through a window. */}
            <div
              aria-hidden
              className={`${step.tint} h-36 overflow-hidden border-b border-line-soft px-4 pt-4 select-none md:h-40 adult:bg-surface-muted`}
            >
              {step.picture}
            </div>
            <div className="flex flex-1 flex-col items-start gap-3 p-5 md:p-6">
              <div className="flex items-center gap-3">
                <StepNumber number={index + 1} size="small" />
                <h3 className="font-heading text-xl font-semibold text-ink">
                  <span className="sr-only">Step {index + 1}: </span>
                  {step.title}
                </h3>
              </div>
              <p className="text-ink-muted">{step.text}</p>
              <Link href={step.href} className={`${stretchedActionClass} mt-auto`}>
                {step.action}
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none adult:transition-none adult:group-hover:translate-x-0"
                >
                  →
                </span>
              </Link>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-center gap-3 adult:justify-start">
        <p className="text-ink-muted">Looking for something else?</p>
        {ELSEWHERE.map((link) => (
          <Link key={link.href} href={link.href} className={secondaryLinkClass}>
            {link.label} <span aria-hidden>→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// A sheet of the surface colour inside a picture, standing for part of a page. Its foot runs off
// the picture's edge, so it has no bottom corners or border.
const sheetClass = "rounded-t-lg border border-b-0 border-line bg-surface shadow-sm adult:shadow-none";

// A grey bar where a home's name or a figure would be.
function Bar({ className }: { className: string }) {
  return <span className={`block h-2 rounded-full bg-line ${className}`} />;
}

// The search page: the box, the list of homes and the map beside it with its pins.
function SearchPicture() {
  return (
    <div className="grid h-full grid-cols-[3fr_2fr] gap-3">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex h-8 items-center gap-2 rounded-full border border-line bg-surface px-3 text-xs text-ink-muted shadow-sm adult:rounded-md adult:shadow-none">
          <Icon name="search" className="size-3.5 shrink-0" />
          <span className="truncate">Name, town, county or Eircode</span>
        </div>
        <div className={`${sheetClass} flex flex-1 flex-col divide-y divide-line-soft`}>
          {["w-3/5", "w-2/5", "w-1/2"].map((width) => (
            <div key={width} className="flex items-center gap-2.5 px-3 py-2.5">
              <Icon name="home" className="size-4 shrink-0 text-primary" />
              <span className="flex flex-1 flex-col gap-1.5">
                <Bar className={width} />
                <Bar className="w-1/4 opacity-60" />
              </span>
            </div>
          ))}
        </div>
      </div>
      {/* Roads in the surface colour and pins in the primary one: no real place. */}
      <svg viewBox="0 0 160 144" preserveAspectRatio="xMidYMid slice" className="h-full w-full rounded-t-lg border border-b-0 border-line bg-surface-muted">
        <g className="stroke-line" fill="none" strokeWidth={5} strokeLinecap="round">
          <path d="M-10 40 C40 30 70 70 170 50" />
          <path d="M50 -10 C60 50 30 90 60 160" />
          <path d="M-10 110 C50 100 110 130 170 100" />
        </g>
        <g className="fill-primary">
          {[[38, 36], [104, 52], [66, 96], [128, 112]].map(([x, y]) => (
            <path key={`${x}-${y}`} transform={`translate(${x} ${y})`} d="M0 0c-5-6.5-8-10-8-14a8 8 0 1 1 16 0c0 4-3 7.500-8 14z" />
          ))}
        </g>
        <g className="fill-surface">
          {[[38, 22], [104, 38], [66, 82], [128, 98]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={3} />
          ))}
        </g>
      </svg>
    </div>
  );
}

// A home's record: its tabs by their own names, then results with the site's judgement marks.
function RecordPicture() {
  const tabs = ["Overview", CENTRE_SECTION_TITLES["look-first"], CENTRE_SECTION_TITLES["next-steps"], CENTRE_SECTION_TITLES.questions];
  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* shrink-0: the rows below are cut off at the picture's foot, not the tabs squeezed. */}
      <div className="flex shrink-0 gap-1 overflow-hidden text-xs font-semibold whitespace-nowrap">
        {tabs.map((tab, index) => (
          <span
            key={tab}
            className={`rounded-t-md border border-b-0 border-line px-2.5 py-1.5 ${index === 1 ? "bg-surface text-ink" : "bg-surface-muted text-ink-muted"}`}
          >
            {tab}
          </span>
        ))}
      </div>
      <div className="flex flex-1 flex-col divide-y divide-line-soft rounded-tr-lg border border-b-0 border-line bg-surface text-xs shadow-sm adult:shadow-none">
        {(
          [
            ["not-compliant", "Not compliant", "w-2/5"],
            ["substantially-compliant", "Substantially compliant", "w-1/2"],
            ["compliant", "Compliant", "w-1/3"],
          ] as const
        ).map(([judgement, label, width]) => (
          <div key={judgement} className="flex items-center gap-2.5 px-3 py-2.5">
            <JudgementIcon judgement={judgement} />
            <Bar className={width} />
            <span className="ml-auto shrink-0 text-ink-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// The comparison: two homes as columns, with the page's own groups as rows.
function ComparePicture() {
  return (
    <div className={`${sheetClass} grid h-full grid-cols-[1.4fr_1fr_1fr] content-start text-xs`}>
      <span className="border-b border-line-soft px-2.5 py-2" />
      {[0, 1].map((home) => (
        <span key={home} className="flex items-center gap-1.5 border-b border-l border-line-soft px-2 py-2">
          <Icon name="home" className="size-3.5 shrink-0 text-primary" />
          <Bar className="w-full" />
        </span>
      ))}
      {["Cost", "What it offers", "Inspections"].map((row) => (
        <ComparePictureRow key={row} label={row} />
      ))}
    </div>
  );
}

function ComparePictureRow({ label }: { label: string }) {
  return (
    <>
      <span className="truncate border-b border-line-soft px-2.5 py-2 font-semibold text-ink-muted">{label}</span>
      {[0, 1].map((home) => (
        <span key={home} className="flex items-center border-b border-l border-line-soft px-2 py-2">
          <Bar className={home === 0 ? "w-3/4" : "w-1/2"} />
        </span>
      ))}
    </>
  );
}

// A guide: three of its own questions or headings, with a box to tick or a step's number.
function ListPicture({ items, mark }: { items: string[]; mark: "box" | "number" }) {
  return (
    <div className={`${sheetClass} flex h-full flex-col divide-y divide-line-soft text-xs`}>
      {items.map((item, index) => (
        <div key={item} className="flex items-center gap-2.5 px-3 py-2.5">
          {mark === "box" ? (
            <span className="size-3.5 shrink-0 rounded-sm border-2 border-field" />
          ) : (
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[0.6875rem] font-semibold text-on-primary">
              {index + 1}
            </span>
          )}
          <span className="truncate text-ink-muted">{item}</span>
        </div>
      ))}
    </div>
  );
}
