import Link from "next/link";
import type { ReactNode } from "react";
import { GuideEnding } from "@/components/guides/guide-ending";
import { guideMetadata } from "@/components/guides/guide-header";
import { GuideHero } from "@/components/guides/guide-hero";
import { ImageViewer } from "@/components/guides/image-viewer";
import { StepNumber } from "@/components/guides/step-number";
import { getGuide } from "@/lib/guides";

const guide = getGuide("using-clearcare");

export const metadata = guideMetadata(guide);

// The site is still changing, so the guide says when it was last checked against it. Update this
// whenever the steps change.
const LAST_UPDATED = { iso: "2026-10-21", label: "21 October 2026" };

// The "How to use the ClearCare website" flowchart in the adult-centred design reference, rendered
// to PNG at 2.5x. 3120 x 2925.
const FLOWCHART = "/guides/using-clearcare-flowchart.png";

// One route through the site, in the flowchart's order. An optional step has a question instead of
// a number: the reader decides whether they need it.
type Step = {
  title: string;
  where: string;
  detail: ReactNode;
  link?: { href: string; label: string };
  question?: string;
};

const STEPS: Step[] = [
  {
    question: "Is the website hard to read (e.g., colour, navigation)?",
    title: "Turn on Easier to read",
    where: "Every page",
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
    where: "Resources → Guides",
    detail: "Start here. It shows every step, from the first conversation to moving in.",
    link: { href: "/guides/user-journey", label: "Read the guide" },
  },
  {
    title: "Read Fair Deal Explained",
    where: "Fair Deal page",
    detail: "How the scheme works, who qualifies and how to apply. It has its own link in the menu.",
    link: { href: "/guides/fair-deal", label: "Read about Fair Deal" },
  },
  {
    title: "Read Questions to Ask",
    where: "Resources → Guides",
    detail: "What to ask before and during your search.",
    link: { href: "/guides/choosing-a-nursing-home", label: "Read the guide" },
  },
  {
    question: "Do you want to learn how to read inspection reports?",
    title: "Read How to Read a HIQA Inspection Report",
    where: "Resources → Guides",
    detail: "What each part of a report means, and how ClearCare shows it.",
    link: { href: "/guides/reading-inspection-reports", label: "Read the guide" },
  },
  {
    title: "Search for the home",
    where: "Search for Homes",
    detail: "Search by the home’s name or by county. Select a result to open the home’s page.",
    link: { href: "/search", label: "Search for a home" },
  },
  {
    title: "Call the home",
    where: "The home’s page",
    detail: (
      <>
        Call the number displayed at the top of the home’s page. Ask your questions, such as how many beds are free.
        ClearCare doesn’t show free beds.
      </>
    ),
  },
  {
    question: "Do you wish to contact someone for help?",
    title: "Find who to contact",
    where: "Contacts page",
    detail: "HIQA, the Fair Deal offices, dementia services, and support and advocacy groups.",
    link: { href: "/contacts", label: "See contacts" },
  },
];

// Each step's number, or null for an optional one, so the numbers run 1 to 5 past the optional steps.
const NUMBERS = STEPS.reduce<(number | null)[]>((numbers, step) => {
  const last = numbers.findLast((n) => n !== null) ?? 0;
  return [...numbers, step.question ? null : last + 1];
}, []);

function MapPin() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      <path d="M12 21s7-6.4 7-11.5a7 7 0 0 0-14 0C5 14.6 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

// A step as a card. Numbered steps are for everyone; an optional one is tinted, labelled
// "Optional" and opens with its question.
function StepCard({ step, number }: { step: Step; number: number | null }) {
  const optional = number === null;

  return (
    <li
      className={`flex gap-4 rounded-lg border p-5 md:gap-6 md:p-6 ${
        optional ? "border-line border-l-4 border-l-primary bg-surface-muted" : "border-line bg-surface"
      }`}
    >
      {number !== null && <StepNumber number={number} />}
      <div className="flex min-w-0 flex-col gap-2">
        {optional && (
          <span className="w-fit rounded border border-field px-1.5 py-0.5 text-xs text-ink-muted">Optional</span>
        )}
        {step.question && <p className="font-semibold">{step.question} If so:</p>}
        <h2 className="font-heading text-xl font-semibold md:text-2xl">
          {number !== null && <span className="sr-only">Step {number}: </span>}
          {step.title}
        </h2>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <MapPin />
          <span>
            <span className="sr-only">Where on the site: </span>
            {step.where}
          </span>
        </p>
        <p className="max-w-3xl leading-relaxed">{step.detail}</p>
        {step.link && (
          <Link href={step.link.href} className="w-fit py-1 font-semibold tap-target">
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

      <figure className="flex flex-col gap-2">
        <ImageViewer
          src={FLOWCHART}
          alt="Flowchart of how to use ClearCare, from opening the site to visiting homes. The steps are written out below."
          width={3120}
          height={2925}
        />
        <figcaption className="text-sm text-ink-muted">Select the flowchart to open it full size.</figcaption>
      </figure>

      <section aria-labelledby="steps-h" className="flex flex-col gap-4">
        <h2 id="steps-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          The steps in words
        </h2>
        <ol className="flex max-w-4xl flex-col gap-4">
          {STEPS.map((step, index) => (
            <StepCard key={step.title} step={step} number={NUMBERS[index]} />
          ))}
        </ol>
        <p className="max-w-3xl text-ink-muted">
          Then visit the homes on your list, ask your questions and decide. ClearCare does not rate or recommend homes.
          Lost? Select <strong>ClearCare</strong> at the top of any page to go back to the home page.
        </p>
      </section>

      <GuideEnding current={guide} />
    </>
  );
}
