import { GeneralGuideNote } from "@/components/guides/general-guide-note";
import { GuideHeader, guideMetadata } from "@/components/guides/guide-header";
import { ImageViewer } from "@/components/guides/image-viewer";
import { Section } from "@/components/layout/section";
import { getGuide } from "@/lib/guides";

const guide = getGuide("user-journey");

export const metadata = guideMetadata(guide);

// The simplified flowchart (CCARE-97): the steps part of the SVG in the adult-centred design
// reference, rendered to PNG. The question and document cards below it there aren't shown here.
// The page shows it without the general guide note (GeneralGuideNote gives it as text); the
// download has the note drawn in. Both are 2916 x 2060.
const FLOWCHART = "/guides/nursing-home-flowchart-steps.png";
const FLOWCHART_DOWNLOAD = "/guides/nursing-home-flowchart-with-guide.png";

// The same steps as the flowchart, for screen readers and small screens.
const STEPS: { title: string; detail: string; ifNo?: string }[] = [
  {
    title: "Talk about what to do",
    detail: "With the person, their GP or nurse. Is a nursing home right?",
    ifNo: "Get help at home, day care or short stays instead.",
  },
  { title: "Apply for Fair Deal", detail: "Send one form to your HSE office." },
  {
    title: "HSE checks care needs",
    detail: "A nurse or doctor visits the person. Is long-term care needed?",
    ifNo: "Appeal within 8 weeks, or apply again after 6 months, then try again.",
  },
  { title: "HSE checks your money", detail: "Works out what you pay each week." },
  {
    title: "Decide what matters most",
    detail: "Area, care needs, daily routine. You can start this after step 2.",
  },
  {
    title: "Find and visit homes",
    detail: "Read HIQA reports, then visit. You can start this after step 2. Is there room at your top choice?",
    ifNo: "Join its waiting list, or go elsewhere for now and move later, then sign.",
  },
  { title: "Read the contract", detail: "Agree any extra costs first." },
];

export default function UserJourneyGuide() {
  return (
    <>
      <GuideHeader guide={guide} />

      <figure className="flex flex-col gap-2">
        <ImageViewer
          src={FLOWCHART}
          alt="Flowchart of how a family chooses a nursing home, from talking about what to do to moving in. The steps are written out below."
          width={2916}
          height={2060}
        />
        <figcaption className="text-sm text-ink-muted">Select the flowchart to open it full size.</figcaption>
      </figure>

      <a
        href={FLOWCHART_DOWNLOAD}
        download="choosing-a-nursing-home-flowchart.png"
        className="flex min-h-12 w-fit items-center gap-3 rounded-md border border-line bg-surface px-4 py-3 font-semibold hover:border-primary"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5 shrink-0"
        >
          <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
        </svg>
        Download guide as a picture
      </a>

      <GeneralGuideNote />

      <Section title="The steps in words">
        <ol className="max-w-3xl divide-y divide-line-soft rounded-lg border border-line bg-surface">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3 px-4 py-3">
              <span className="font-mono text-sm text-ink-muted">{index + 1}</span>
              <div className="flex flex-col gap-1">
                <span className="font-semibold">{step.title}</span>
                <span>{step.detail}</span>
                {step.ifNo && <span className="text-sm text-ink-muted">If not: {step.ifNo}</span>}
              </div>
            </li>
          ))}
          <li className="flex gap-3 px-4 py-3">
            <span aria-hidden className="font-mono text-sm text-ink-muted">✓</span>
            <div className="flex flex-col gap-1">
              <span className="font-semibold">Move in</span>
              <span>Funding and the care plan start.</span>
            </div>
          </li>
        </ol>
      </Section>
    </>
  );
}
