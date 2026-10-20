import { GuideHeader, guideMetadata } from "@/components/guides/guide-header";
import { ImageViewer } from "@/components/guides/image-viewer";
import { Section } from "@/components/layout/section";
import { getGuide } from "@/lib/guides";

const guide = getGuide("user-journey");

export const metadata = guideMetadata(guide);

// The flowchart from Research/Guides (CCARE-71), copied to public/ so the site can serve it.
const FLOWCHART = "/guides/nursing-home-flowchart.png";

// The same steps as the flowchart, for screen readers and small screens.
const STEPS: { title: string; detail: string; ifNo?: string }[] = [
  {
    title: "Talk through the options",
    detail: "With the person, their GP or a nurse. Is a nursing home the right step?",
    ifNo: "Home support, day care or respite (not Fair Deal).",
  },
  { title: "Apply to Fair Deal", detail: "One form, sent to your local HSE office." },
  {
    title: "Care needs assessment (HSE)",
    detail: "A nurse or doctor visits. Is long-term care needed?",
    ifNo: "Appeal within 8 weeks (40 working days), or reapply in 6 months, then try again.",
  },
  { title: "Financial assessment (HSE)", detail: "Sets your weekly contribution." },
  {
    title: "Decide what matters",
    detail: "Area, care level, routine. You can start this once you have applied (step 2).",
  },
  {
    title: "Shortlist and visit homes",
    detail: "Using HIQA reports and the approved list. Is there a place at your first choice home?",
    ifNo: "Join its waiting list, or stay elsewhere and ask to transfer, then sign.",
  },
  { title: "Check the contract", detail: "Agree any extra charges." },
];

export default function UserJourneyGuide() {
  return (
    <>
      <GuideHeader guide={guide} />

      <figure className="flex flex-col gap-2">
        <ImageViewer
          src={FLOWCHART}
          alt="Flowchart of how a family chooses a nursing home, from talking through the options to moving in. The steps are written out below."
          width={2916}
          height={2240}
        />
        <figcaption className="text-sm text-ink-muted">Select the flowchart to open it full size.</figcaption>
      </figure>

      <aside className="max-w-3xl rounded-lg border border-line border-l-4 border-l-primary bg-surface px-4 py-3 text-sm">
        <span className="font-semibold">This is a general guide.</span> It shows the ideal way to choose a nursing home.
        It is not advice. Every case is different. After an accident or a hospital stay, for example, the process may
        move faster with less choice of home. Check your own situation with the HSE, a GP or a social worker.
      </aside>

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
              <span>Funding starts and the care plan starts.</span>
            </div>
          </li>
        </ol>
      </Section>
    </>
  );
}
