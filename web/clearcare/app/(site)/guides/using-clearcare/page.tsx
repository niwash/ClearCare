import Link from "next/link";
import type { ReactNode } from "react";
import { GuideEnding } from "@/components/guides/guide-ending";
import { guideMetadata } from "@/components/guides/guide-header";
import { GuideHero } from "@/components/guides/guide-hero";
import { ImageViewer } from "@/components/guides/image-viewer";
import { StepNumber } from "@/components/guides/step-number";
import { MAX_COMPARED } from "@/lib/compare";
import { getGuide } from "@/lib/guides";

const guide = getGuide("using-clearcare");

export const metadata = guideMetadata(guide);

// The site is still changing, so the guide says when it was last checked against it. Update this
// whenever the steps change.
const LAST_UPDATED = { iso: "2026-10-29", label: "29 October 2026" };

// The "How to use the ClearCare website" flowchart in the adult-centred design reference, rendered
// to PNG at 2.5x. 3120 x 2925. Its third row has Compare homes as step 5 (CCARE-179), drawn to
// match the rest.
// A new name when the drawing changes, so no cached copy of the old one is shown.
const FLOWCHART = "/guides/using-clearcare-flowchart-compare.png";

// One route through the site, in the flowchart's order. An optional step has a question instead of
// a number: the reader decides whether they need it.
type Step = {
  title: string;
  detail: ReactNode;
  // Says where it goes, never just "Read the guide": several steps link to different guides.
  link?: { href: string; label: string };
  question?: string;
};

const STEPS: Step[] = [
  {
    question: "Is the website hard to read (e.g., colour, navigation)?",
    title: "Turn on Easier to read",
    detail: (
      <>
        Select <strong>Easier to read</strong> at the top of any page. It makes the text larger and stronger, underlines
        the links, and keeps the menu in view. The button beside it switches between light and dark. Your choice is
        remembered on this device.
      </>
    ),
  },
  {
    title: "Read How a Family Chooses a Nursing Home",
    detail: "Start here. It shows every step, from the first conversation to moving in.",
    link: { href: "/guides/how-a-family-chooses", label: "Open How a Family Chooses a Nursing Home" },
  },
  {
    title: "Read Fair Deal Explained",
    detail: "How the scheme works, who qualifies and how to apply. It has its own link in the menu.",
    link: { href: "/guides/fair-deal", label: "Open Fair Deal Explained" },
  },
  {
    title: "Read Questions to Ask",
    detail: "What to ask before and during your search.",
    link: { href: "/guides/choosing-a-nursing-home", label: "Open Questions to Ask" },
  },
  {
    question: "Do you want to learn how to read inspection reports?",
    title: "Read How to Read a HIQA Inspection Report",
    detail: "What each part of a report means, and how ClearCare shows it.",
    link: { href: "/guides/reading-inspection-reports", label: "Open How to Read a HIQA Inspection Report" },
  },
  {
    title: "Search for the home",
    detail: "Search by the home’s name or by county. Select a result to open the home’s page.",
    link: { href: "/search", label: "Search for a home" },
  },
  {
    title: "Compare homes",
    detail: (
      <>
        Choose <strong>Add to shortlist</strong> on a home’s page or in the search results to save up to{" "}
        {MAX_COMPARED}. <strong>Compare Homes</strong> shows them side by side: the cost, the home and what HIQA
        found.
      </>
    ),
    link: { href: "/compare", label: "Open Compare Homes" },
  },
  {
    title: "Call the home",
    detail: (
      <>
        Call the number on the home’s page, under About this home. Ask your questions, such as how many beds are free.
        ClearCare doesn’t show free beds.
      </>
    ),
  },
  {
    question: "Do you wish to contact someone for help?",
    title: "Find who to contact",
    detail: "HIQA, the Fair Deal offices, dementia services, and support and advocacy groups.",
    link: { href: "/contacts", label: "See contacts" },
  },
];

// A step as a card. Numbered steps are for everyone; an optional one is tinted, labelled
// "Optional" and opens with its question. Kept compact, one under another (CCARE-164: less
// scrolling).
// position counts every step, optional ones too: it names the card's id, step-1 to step-9, which a
// guide opened from here links back to.
function StepCard({ step, number, position }: { step: Step; number: number | null; position: number }) {
  const optional = number === null;
  // A guide opened from a step offers a way back to that step (components/guides/return-link.tsx).
  const href =
    step.link && step.link.href.startsWith("/guides/")
      ? `${step.link.href}?${new URLSearchParams({ from: "using-clearcare", step: String(position) })}`
      : step.link?.href;

  return (
    <li
      id={`step-${position}`}
      className={`flex scroll-mt-6 gap-4 rounded-lg border p-4 md:p-5 ${
        optional ? "border-line border-l-4 border-l-primary bg-surface-muted" : "border-line bg-surface"
      }`}
    >
      {number !== null && <StepNumber number={number} />}
      <div className="flex min-w-0 flex-col gap-1.5">
        {optional && (
          <span className="w-fit rounded border border-field px-1.5 py-0.5 text-xs text-ink-muted">Optional</span>
        )}
        {step.question && <p className="font-semibold">{step.question} If so:</p>}
        <h3 className="font-heading text-lg font-semibold md:text-xl">
          {number !== null && <span className="sr-only">Step {number}: </span>}
          {step.title}
        </h3>
        <p className="max-w-3xl leading-relaxed">{step.detail}</p>
        {step.link && href && (
          <Link href={href} className="w-fit py-1 font-semibold tap-target">
            {step.link.label} →
          </Link>
        )}
      </div>
    </li>
  );
}

export default function UsingClearCareGuide() {
  return (
    <>
      <GuideHero guide={guide} />

      {/* The site is still being built, so say so before anyone relies on the steps. */}
      <aside className="max-w-3xl rounded-lg border border-line border-l-4 border-l-primary bg-surface px-4 py-3 text-sm">
        <p>
          <span className="font-semibold">ClearCare is a work in progress.</span> Pages, buttons and menus may move or
          change, and we’ll update this guide when they do.
        </p>
        <p className="mt-1 text-ink-muted">
          Last updated <time dateTime={LAST_UPDATED.iso}>{LAST_UPDATED.label}</time>
        </p>
      </aside>

      <section aria-labelledby="steps-h" className="flex flex-col gap-4">
        <h2 id="steps-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Recommended steps
        </h2>
        {/* Starts the welcome tour on arrival (components/home/welcome-tour.tsx). */}
        <p className="max-w-3xl">
          Prefer to be shown around?{" "}
          <Link href="/?tour" className="font-semibold tap-target">
            Take the tour on the home page →
          </Link>
        </p>
        <ol className="flex max-w-4xl flex-col gap-3">
          {/* An optional step has no number, so the numbers run 1 to 6 past the optional steps. */}
          {STEPS.map((step, index) => (
            <StepCard
              key={step.title}
              step={step}
              number={step.question ? null : STEPS.slice(0, index).filter((s) => !s.question).length + 1}
              position={index + 1}
            />
          ))}
        </ol>
        <p className="max-w-3xl text-ink-muted">
          Then visit the homes on your list, ask your questions and decide. ClearCare does not rate or recommend homes.
          Lost? Select <strong>ClearCare</strong> at the top of any page to go back to the home page.
        </p>
      </section>

      {/* After the steps in words, which come first (CCARE-164). It opens full size when selected. */}
      <figure className="flex flex-col gap-2">
        <ImageViewer
          src={FLOWCHART}
          alt="Flowchart of how to use ClearCare, from opening the site to visiting homes. The steps are written out above."
          width={3120}
          height={2925}
        />
        <figcaption className="text-ink-muted">Select the image to open it in full size.</figcaption>
      </figure>

      <GuideEnding current={guide} />
    </>
  );
}
