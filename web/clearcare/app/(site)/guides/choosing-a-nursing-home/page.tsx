import Link from "next/link";
import type { ReactNode } from "react";
import { GuideEnding } from "@/components/guides/guide-ending";
import { guideMetadata } from "@/components/guides/guide-header";
import { GuideHero } from "@/components/guides/guide-hero";
import { Placeholder } from "@/components/placeholder/placeholder";
import { getGuide, type GuideSlug } from "@/lib/guides";

const guide = getGuide("choosing-a-nursing-home");

export const metadata = guideMetadata(guide);

type Question = {
  question: string;
  // Shown when the question is expanded; until it's written, a placeholder shows instead
  answer?: ReactNode;
};

type Stage = {
  title: string;
  questions: Question[];
  // Another guide that answers this stage's questions, if there is one
  relatedGuide?: GuideSlug;
};

const STAGES: Stage[] = [
  {
    title: "Recognising the Need",
    questions: [
      { question: "Have you accepted that a nursing home is the right next step, rather than home care or another option?" },
      { question: "Do you know whose decision this is, and is the person involved in making it?" },
      { question: "Has a HSE care needs assessment been done, or do you know how to get one?" },
    ],
  },
  {
    title: "Understanding the Care Required",
    questions: [
      { question: "Do you know what level of care is needed, whether that is personal care, nursing care, or specialist dementia care?" },
      { question: "Do you know whether those needs are likely to change, and have you thought about a home that can grow with them?" },
    ],
  },
  {
    title: "Sorting Out Funding",
    questions: [
      { question: "Do you know about the Fair Deal scheme and whether you qualify?" },
      { question: "Do you know what the application process involves and how long it takes?" },
      { question: "Do you understand what costs Fair Deal does not cover?" },
    ],
    relatedGuide: "fair-deal",
  },
  {
    title: "Knowing What You Want",
    questions: [
      { question: "Do you know which area or county you want to search in?" },
      { question: "Have you thought about how often family will visit and how far is realistic?" },
      { question: "Do you know what amenities matter most to the person moving in?" },
      { question: "Have you thought about their daily routine, social preferences, and any cultural, religious, or language needs?" },
    ],
  },
  {
    title: "Evaluating Homes",
    questions: [
      { question: "Do you know what HIQA is and how to read an inspection report?" },
      { question: "Do you know what questions to ask when you visit a home?" },
      { question: "Do you know what to look for in a contract before signing?" },
    ],
    relatedGuide: "reading-inspection-reports",
  },
];

export default function ChoosingANursingHomeGuide() {
  return (
    <>
      <GuideHero guide={guide} />

      <div className="flex max-w-3xl flex-col gap-4">
        <p className="md:text-lg">
          Before you start browsing homes, it helps to pause and ask yourself a few key questions. This checklist walks
          you through the stages most families go through, so you can search with clarity and confidence.
        </p>
        {/* The questions are written but the answers aren't, so say so before anyone opens one. */}
        <p className="rounded-lg border border-line border-l-4 border-l-primary bg-surface px-4 py-3 text-sm">
          <span className="font-semibold">This guide is a work in progress.</span> The questions are ready to use as
          a checklist, but the answers aren&apos;t written yet.
        </p>
      </div>

      {/* The five stages at a glance, each a link down to its card. */}
      <nav aria-label="Stages" className="max-w-4xl">
        <ol className="flex flex-wrap gap-2">
          {STAGES.map((stage, index) => (
            <li key={stage.title}>
              <a
                href={`#stage-${index + 1}`}
                className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4 text-sm font-semibold text-ink no-underline hover:border-primary hover:text-ink"
              >
                <span aria-hidden className="grid size-8 place-items-center rounded-full bg-primary text-on-primary">
                  {index + 1}
                </span>
                {stage.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <ol className="flex max-w-4xl flex-col gap-4 md:gap-6">
        {STAGES.map((stage, index) => {
          // A guide that isn't written yet isn't linked, as on the resources page.
          const relatedGuide = stage.relatedGuide && getGuide(stage.relatedGuide);
          const related = relatedGuide && relatedGuide.status !== "coming-soon" ? relatedGuide : undefined;
          return (
            // scroll-mt keeps the card's heading clear of the top of the window when jumped to.
            <li
              key={stage.title}
              id={`stage-${index + 1}`}
              className="flex scroll-mt-6 flex-col gap-4 rounded-lg border border-line bg-surface p-5 md:p-8"
            >
              <div className="flex items-center gap-4">
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-primary font-heading text-lg font-semibold text-on-primary md:size-12 md:text-xl"
                >
                  {index + 1}
                </span>
                <h2 className="font-heading text-xl font-semibold md:text-2xl">
                  <span className="sr-only">Stage {index + 1}: </span>
                  {stage.title}
                </h2>
              </div>
              <ul className="divide-y divide-line-soft rounded-lg border border-line-soft">
                {stage.questions.map(({ question, answer }) => (
                  <li key={question}>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
                        {question}
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mt-0.5 size-5 shrink-0 text-ink-muted transition-transform group-open:rotate-90"
                        >
                          <path d="m9 6 6 6-6 6" />
                        </svg>
                      </summary>
                      <div className="px-4 pb-3 text-sm text-ink-muted">
                        {answer ?? <Placeholder>Answer coming soon</Placeholder>}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
              {related && (
                <p className="text-sm">
                  <Link href={`/guides/${related.slug}`} className="tap-target">Read: {related.title} →</Link>
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <GuideEnding current={guide} />
    </>
  );
}
