import Link from "next/link";
import { GeneralGuideNote } from "@/components/guides/general-guide-note";
import { GuideEnding } from "@/components/guides/guide-ending";
import { guideMetadata } from "@/components/guides/guide-header";
import { GuideHero } from "@/components/guides/guide-hero";
import { ImageViewer } from "@/components/guides/image-viewer";
import { StepNumber } from "@/components/guides/step-number";
import { Section } from "@/components/layout/section";
import { getGuide } from "@/lib/guides";
import { smallLinkButtonClass } from "@/components/ui/classes";
import { Icon } from "@/components/ui/icons";

const guide = getGuide("how-a-family-chooses");

export const metadata = guideMetadata(guide);

// The simplified flowchart (CCARE-97): the steps part of the SVG in the adult-centred design
// reference, rendered to PNG. The question and document cards below it there aren't shown here.
// The page shows it without the general guide note (GeneralGuideNote gives it as text); the
// download has the note drawn in. Both are 2916 x 2060, without the HSE and HIQA logos the
// reference once had (CCARE-164). A redrawn PNG gets a new file name, so no cache keeps the old one:
// v2 says "HSE assesses your money" at step 4 (CCARE-208).
const FLOWCHART = "/guides/how-a-family-chooses-flowchart-v2.png";
const FLOWCHART_DOWNLOAD = "/guides/how-a-family-chooses-flowchart-with-note-v2.png";

// The same steps as the flowchart, for screen readers and small screens. The words are the
// flowchart's; links are where ClearCare has a page that helps with the step (CCARE-233), each
// saying where it goes.
type Step = { title: string; detail: string; ifNo?: string; links?: { href: string; label: string }[] };

const STEPS: Step[] = [
  {
    title: "Talk about what to do",
    detail: "With the person, their GP or nurse. Is a nursing home right?",
    ifNo: "Get help at home, day care or short stays instead.",
    links: [{ href: "/guides/choosing-a-nursing-home#stage-1", label: "Questions to ask at this stage" }],
  },
  {
    title: "Apply for Fair Deal",
    detail: "Send one form to your HSE office.",
    links: [{ href: "/guides/fair-deal#how-to-apply", label: "How to apply for Fair Deal" }],
  },
  {
    title: "HSE checks care needs",
    detail: "A nurse or doctor visits the person. Is long-term care needed?",
    ifNo: "Appeal within 8 weeks, or apply again after 6 months, then try again.",
  },
  {
    title: "HSE assesses your money",
    detail: "Works out what you pay each week.",
    links: [{ href: "/guides/fair-deal#how-much-will-you-pay", label: "How much you will pay" }],
  },
  {
    title: "Decide what matters most",
    detail: "Area, care needs, daily routine. You can start this after step 2.",
    links: [{ href: "/guides/choosing-a-nursing-home#stage-4", label: "Questions about what you want" }],
  },
  {
    title: "Find and visit homes",
    detail: "Read HIQA reports, then visit. You can start this after step 2. Is there room at your top choice?",
    ifNo: "Join its waiting list, or go elsewhere for now and move later, then sign.",
    links: [
      { href: "/search", label: "Search for a home" },
      { href: "/guides/reading-inspection-reports", label: "How to read a HIQA report" },
    ],
  },
  {
    title: "Read the contract",
    detail: "Agree any extra costs first.",
    links: [{ href: "/guides/choosing-a-nursing-home#stage-5", label: "What to look for in a contract" }],
  },
];

// A step as a card, like the steps of How to navigate ClearCare: its number in a circle, what to
// do, what to do if the answer is no on a tinted line of its own, and buttons to the pages that help.
function StepCard({ step, number }: { step: Step; number: number }) {
  return (
    <li className="flex gap-4 rounded-lg border border-line bg-surface p-4 md:p-5">
      <StepNumber number={number} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="font-heading text-lg font-semibold md:text-xl">
          <span className="sr-only">Step {number}: </span>
          {step.title}
        </h3>
        <p className="leading-relaxed">{step.detail}</p>
        {step.ifNo && (
          <p className="rounded-md border-l-4 border-l-primary bg-surface-muted px-3 py-2 text-sm">
            <span className="font-semibold">If not:</span> {step.ifNo}
          </p>
        )}
        {step.links && (
          <div className="mt-1 flex flex-wrap gap-2">
            {step.links.map((link) => (
              <Link key={link.href} href={link.href} className={smallLinkButtonClass}>
                {link.label} <span aria-hidden>→</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

export default function UserJourneyGuide() {
  return (
    <>
      <GuideHero guide={guide} />

      <GeneralGuideNote />

      {/* From desktop width the steps and the flowchart are side by side, the picture staying in view
          as the steps scroll, rather than a narrow column of steps with the rest of the row empty
          and the picture far below (CCARE-233). On narrower screens the steps come first, in words
          (CCARE-164), then the picture. */}
      <div className="grid items-start gap-8 lg:grid-cols-[3fr_2fr]">
        <Section title="Step by step">
          <ol className="flex flex-col gap-3">
            {STEPS.map((step, index) => (
              <StepCard key={step.title} step={step} number={index + 1} />
            ))}
            <li className="flex items-center gap-4 rounded-lg border border-line bg-tint-sage p-4 md:p-5 adult:bg-surface-muted">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-on-primary md:size-12">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="size-5 md:size-6">
                  <path d="M5 12.5 10 17.5 19 7" />
                </svg>
              </span>
              <div className="flex flex-col gap-0.5">
                <h3 className="font-heading text-lg font-semibold md:text-xl">Move in</h3>
                <p>Funding and the care plan start.</p>
              </div>
            </li>
          </ol>
        </Section>

        <div className="flex flex-col gap-3 lg:sticky lg:top-6">
          <h2 className="font-heading text-xl font-semibold md:text-2xl">The steps as a picture</h2>
          {/* It opens full size when selected. */}
          <figure className="flex flex-col gap-2">
            <ImageViewer
              src={FLOWCHART}
              alt="Flowchart of how a family chooses a nursing home, from talking about what to do to moving in. The steps are written out on this page."
              width={2916}
              height={2060}
            />
            <figcaption className="text-ink-muted">Select the image to open it in full size.</figcaption>
          </figure>

          <a href={FLOWCHART_DOWNLOAD} download="choosing-a-nursing-home-flowchart.png" className={smallLinkButtonClass}>
            <Icon name="download" className="size-4" />
            Download guide as a picture
          </a>
        </div>
      </div>

      <GuideEnding current={guide} />
    </>
  );
}
