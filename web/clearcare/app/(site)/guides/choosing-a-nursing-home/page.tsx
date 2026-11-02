import Link from "next/link";
import type { ReactNode } from "react";
import { GuideEnding } from "@/components/guides/guide-ending";
import { guideMetadata } from "@/components/guides/guide-header";
import { GuideHero } from "@/components/guides/guide-hero";
import { ContentsNav, SectionEnd, sectionScrollMargin, StepNumber } from "@/components/guides/step-number";
import { Placeholder } from "@/components/placeholder/placeholder";
import { ShowHide } from "@/components/ui/chevron";
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

// Each answer is a short starting point, not advice for a particular person. Facts about Fair Deal
// are the Fair Deal guide's, which cites the HSE for each; link there rather than repeat the detail.
const STAGES: Stage[] = [
  {
    title: "Recognising the Need",
    questions: [
      {
        question: "Have you accepted that a nursing home is the right next step, rather than home care or another option?",
        answer: (
          <>
            It&apos;s worth ruling other options in or out first. The HSE&apos;s home support service, day centres and
            respite stays can help someone stay at home for longer. A nursing home is usually right when someone needs
            care or nursing around the clock that can&apos;t safely be given at home. Their GP, public health nurse or
            a hospital social worker can help you weigh this up.
          </>
        ),
      },
      {
        question: "Do you know whose decision this is, and is the person involved in making it?",
        answer: (
          <>
            It&apos;s the person&apos;s own decision, with support from family if they want it. Even if they find
            decisions hard, the law expects them to be helped to decide for themselves, and their wishes to be
            respected. If they can&apos;t decide, the{" "}
            <a href="https://www.decisionsupportservice.ie">Decision Support Service</a> explains who can help, such as
            someone they named in an enduring power of attorney.
          </>
        ),
      },
      {
        question: "Has a HSE care needs assessment been done, or do you know how to get one?",
        answer: (
          <>
            A care needs assessment checks whether someone needs long-term nursing home care. If you apply for Fair
            Deal, the HSE arranges it for you, with a visit from a healthcare professional such as a public health
            nurse. If the person is in hospital, ask their social worker or care team.{" "}
            <Link href="/guides/fair-deal#how-to-apply">How to apply for Fair Deal →</Link>
          </>
        ),
      },
    ],
  },
  {
    title: "Understanding the Care Required",
    questions: [
      {
        question: "Do you know what level of care is needed, whether that is personal care, nursing care, or specialist dementia care?",
        answer: (
          <>
            The care needs assessment, the person&apos;s GP and their care team are the best guides. Some people mainly
            need help with washing, dressing and meals; others need nursing care, such as for wounds or medication.
            Someone living with dementia may be best in a home with a dedicated dementia unit, so ask each home what it
            can offer.
          </>
        ),
      },
      {
        question: "Do you know whether those needs are likely to change, and have you thought about a home that can grow with them?",
        answer: (
          <>
            Needs often grow over time, and moving homes later can be unsettling. Ask the person&apos;s doctor what to
            expect, and ask each home whether it can keep caring for someone as their needs increase, including at
            the end of life.
          </>
        ),
      },
    ],
  },
  {
    title: "Sorting Out Funding",
    questions: [
      {
        question: "Do you know about the Fair Deal scheme and whether you qualify?",
        answer: (
          <>
            Fair Deal is the government scheme that helps pay for nursing home care. You pay a contribution based on
            your income and what you own, and the State pays the rest. Anyone who ordinarily lives in Ireland and is
            assessed as needing long-term nursing home care can apply.{" "}
            <Link href="/guides/fair-deal#who-can-apply">Who can apply →</Link>
          </>
        ),
      },
      {
        question: "Do you know what the application process involves and how long it takes?",
        answer: (
          <>
            You send a form to your local Nursing Homes Support Office, then the HSE carries out a care needs
            assessment and a financial assessment. How long it takes varies, so apply early: funding is only paid from
            the date your application is approved, not from when the person moved in.{" "}
            <Link href="/guides/fair-deal#how-to-apply">The steps to apply →</Link>
          </>
        ),
      },
      {
        question: "Do you understand what costs Fair Deal does not cover?",
        answer: (
          <>
            Fair Deal covers standard care, but not extras such as hairdressing, some therapies, outings charged by the
            home, personal items, or respite. Ask each home for a written list of its extra charges before you
            decide.{" "}
            <Link href="/guides/fair-deal#what-does-fair-deal-cover">What Fair Deal covers →</Link>
          </>
        ),
      },
    ],
    relatedGuide: "fair-deal",
  },
  {
    title: "Knowing What You Want",
    questions: [
      {
        question: "Do you know which area or county you want to search in?",
        answer: (
          <>
            Many families look near where the person has lived, or near the people who will visit most. Think about
            familiar places, their GP and local friends too. You can{" "}
            <Link href="/search">search for a home by town or county</Link>.
          </>
        ),
      },
      {
        question: "Have you thought about how often family will visit and how far is realistic?",
        answer: (
          <>
            Regular visits matter a great deal to most residents. Work out how long the journey is for the people who
            will visit most, by car and by public transport, and whether that will still work in winter or as they get
            older themselves.
          </>
        ),
      },
      {
        question: "Do you know what amenities matter most to the person moving in?",
        answer: (
          <>
            Ask the person what would make a place feel like home: a single room, a garden, somewhere quiet to read, or
            space to bring their own things. Pick a few that matter most and ask about them on each visit.
          </>
        ),
      },
      {
        question: "Have you thought about their daily routine, social preferences, and any cultural, religious, or language needs?",
        answer: (
          <>
            Think about how they like to spend their day, when they get up, what they enjoy, and whether they like
            company or quiet. Ask homes about activities, mealtimes, religious services, and any language, food or
            cultural needs, and whether they can be met.
          </>
        ),
      },
    ],
  },
  {
    title: "Evaluating Homes",
    questions: [
      {
        question: "Do you know what HIQA is and how to read an inspection report?",
        answer: (
          <>
            HIQA, the Health Information and Quality Authority, is the independent body that registers and inspects
            nursing homes in Ireland and publishes a report after each inspection. ClearCare brings a home&apos;s
            reports together on one page, where we have them.{" "}
            <Link href="/guides/reading-inspection-reports">How to read a report →</Link>
          </>
        ),
      },
      {
        question: "Do you know what questions to ask when you visit a home?",
        answer: (
          <>
            Read the home&apos;s latest inspection report first, and ask about anything it found. Then ask about staff
            and how long they stay, a typical day, activities, food, visiting, and how the home handles a concern or
            complaint. Visit more than once if you can, at different times of day.
          </>
        ),
      },
      {
        question: "Do you know what to look for in a contract before signing?",
        answer: (
          <>
            {/* The 2013 care and welfare regulations (S.I. 415/2013): a contract agreed with each resident on
                admission, with the services and the fees for them. Notice and leaving are in HIQA's
                National Standards. */}
            The home must agree a written contract with the person when they move in, setting out the services and
            the fees. Check the weekly fee, what it includes, what extra charges there are, what happens if fees
            change or they need to leave, and how to make a complaint. The CCPC&apos;s
            guide,{" "}
            <a href="https://www.ccpc.ie/manage-your-money/planning-for-the-future/how-to-plan-for-the-future/moving-into-a-nursing-home">Moving into a nursing home</a>, explains
            your rights.
          </>
        ),
      },
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
        <p className="text-ink-muted">
          Open a question for a short answer and where to find out more. Every family&apos;s situation is different, so
          check anything important with the HSE, your GP or the home.
        </p>
      </div>

      {/* The five stages at a glance, each a link down to its card. */}
      <ContentsNav label="Stages" items={STAGES.map((stage, index) => ({ id: `stage-${index + 1}`, title: stage.title }))} />

      <ol className="flex max-w-4xl flex-col gap-4">
        {STAGES.map((stage, index) => {
          // A guide that isn't written yet isn't linked, as on the resources page.
          const relatedGuide = stage.relatedGuide && getGuide(stage.relatedGuide);
          const related = relatedGuide && relatedGuide.status !== "coming-soon" ? relatedGuide : undefined;
          return (
            // scroll-mt keeps the card's heading clear of the top of the window when jumped to.
            <li
              key={stage.title}
              id={`stage-${index + 1}`}
              className={`flex ${sectionScrollMargin} flex-col gap-4 rounded-lg border border-line bg-surface p-5 md:p-6`}
            >
              <div className="flex items-center gap-4">
                <StepNumber number={index + 1} />
                <h2 className="font-heading text-xl font-semibold md:text-2xl">
                  <span className="sr-only">Stage {index + 1}: </span>
                  {stage.title}
                </h2>
              </div>
              <ul className="divide-y divide-line-soft rounded-lg border border-line-soft">
                {stage.questions.map(({ question, answer }) => (
                  <li key={question}>
                    {/* "Show" or "Hide" as well as the arrow, as in the inspection report guide, so it is
                        clear each question opens. */}
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
                        {question}
                        <ShowHide className="mt-0.5" />
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
              <SectionEnd />
            </li>
          );
        })}
      </ol>

      <GuideEnding current={guide} />
    </>
  );
}
