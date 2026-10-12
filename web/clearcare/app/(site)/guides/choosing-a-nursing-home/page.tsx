import Link from "next/link";
import type { ReactNode } from "react";
import { GuideHeader, guideMetadata } from "@/components/guides/guide-header";
import { Section } from "@/components/layout/section";
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
      <GuideHeader guide={guide} />
      <p className="max-w-3xl">
        Before you start browsing homes, it helps to pause and ask yourself a few key questions. This checklist walks
        you through the stages most families go through, so you can search with clarity and confidence.
      </p>

      {STAGES.map((stage, index) => {
        const related = stage.relatedGuide && getGuide(stage.relatedGuide);
        return (
          <Section key={stage.title} title={`Stage ${index + 1}: ${stage.title}`}>
            <ul className="max-w-3xl divide-y divide-line-soft rounded-lg border border-line bg-surface">
              {stage.questions.map(({ question, answer }) => (
                <li key={question}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
                      {question}
                      <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-5 shrink-0 text-ink-muted transition-transform group-open:rotate-90"
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </summary>
                    <div className="px-4 pb-3 text-sm text-ink-muted">
                      {answer ?? <Placeholder>TBE</Placeholder>}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
            {related && (
              <p className="text-sm">
                <Link href={`/guides/${related.slug}`}>Read: {related.title} →</Link>
              </p>
            )}
          </Section>
        );
      })}
    </>
  );
}
