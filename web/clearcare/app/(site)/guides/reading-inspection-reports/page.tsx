import type { ReactNode } from "react";
import { JudgementIcon } from "@/components/centre/judgement-icon";
import { GuideHeader, guideMetadata } from "@/components/guides/guide-header";
import { Section } from "@/components/layout/section";
import type { Judgement } from "@/lib/centres";
import { getGuide } from "@/lib/guides";

const guide = getGuide("reading-inspection-reports");

export const metadata = guideMetadata(guide);

// Text from Research/Guides/HIQA_Guide.md (CCARE-56).

const JUDGEMENTS: { judgement: Judgement; label: string; meaning: string }[] = [
  { judgement: "compliant", label: "Compliant", meaning: "The requirement was met." },
  {
    judgement: "substantially-compliant",
    label: "Substantially Compliant",
    meaning: "The requirement was largely met, but some improvement was needed.",
  },
  { judgement: "not-compliant", label: "Not Compliant", meaning: "The requirement was not met and action was needed." },
];

const QUESTIONS = [
  "What has changed since this inspection, and how can that be verified?",
  "Have previously identified concerns been addressed?",
  "How are care plans, safety checks and staff training reviewed?",
  "How can residents raise complaints or access meaningful activities?",
];

const CHECKLIST = [
  "Confirm the centre, date and inspection type.",
  "Read each judgement with the supporting evidence.",
  "Note the regulation or topic and the source page.",
  "Look for repeat findings and check later reports.",
  "Keep provider plans separate from inspector conclusions.",
  "Use the report to prepare questions—not to create a simple ranking of homes.",
];

function Prose({ children }: { children: ReactNode }) {
  return <div className="flex max-w-3xl flex-col gap-3 leading-relaxed">{children}</div>;
}

export default function ReadingInspectionReportsGuide() {
  return (
    <>
      <GuideHeader guide={guide} />

      <Section title="1. Start with the basic information">
        <Prose>
          <p>
            Find the nursing home or centre name, inspection date, report type and the areas covered. The date matters:
            a report records what inspectors found during that inspection, not necessarily the centre’s situation
            today. Check whether it is a standard inspection or a thematic inspection, because the layout and focus can
            differ.
          </p>
        </Prose>
      </Section>

      <Section title="2. Understand how ClearCare shows the judgements">
        <Prose>
          <p>
            HIQA uses judgement labels to show how the service met the relevant requirement at the time of inspection.
            On each home’s page, ClearCare shows every label with its own symbol, so you can spot them in the inspection
            history at a glance. Common labels include:
          </p>
          <ul className="divide-y divide-line-soft rounded-lg border border-line bg-surface">
            {JUDGEMENTS.map(({ judgement, label, meaning }) => (
              <li key={judgement} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-1">
                  <JudgementIcon judgement={judgement} size={16} />
                </span>
                <span>
                  <span className="font-semibold">{label}</span> — {meaning}
                </span>
              </li>
            ))}
          </ul>
          <p>
            Always read the exact wording and context in the report. Do not treat one label as a complete summary of
            every aspect of a home’s care.
          </p>
        </Prose>
      </Section>

      <Section title="3. Read the evidence, not just the label">
        <Prose>
          <p>
            The findings section explains why inspectors reached a judgement. Look for specific observations, records
            reviewed, risks identified, and whether an issue was corrected during the inspection. For example, a report
            may describe fire doors or evacuation plans, maintenance problems, infection-control concerns, care-plan
            gaps, incident notifications, staffing or training, or residents’ rights and activities.
          </p>
          <aside className="rounded-lg border border-line border-l-4 border-l-link bg-surface px-4 py-3 text-sm">
            <span className="font-semibold">N.B.</span> These are examples found in the 16 reports hand reviewed by
            ClearCare; they should not be assumed to occur in every nursing home.
          </aside>
        </Prose>
      </Section>

      <Section title="4. Check for repeat issues and follow-up">
        <Prose>
          <p>
            If earlier reports are available, compare the same centre and relevant regulation or topic across
            inspection dates. Ask whether an issue has appeared before, whether the report describes improvement, and
            whether concerns remain. A single report may not show the full history, so avoid drawing conclusions
            without checking the available context.
          </p>
        </Prose>
      </Section>

      <Section title="5. Separate inspector findings from the provider’s response">
        <Prose>
          <p>
            A provider may set out actions it intends to take in a compliance plan. Keep that response distinct from
            the inspector’s judgement: a promise or planned action is not proof that the issue was later resolved. Look
            for evidence in a subsequent report where available.
          </p>
        </Prose>
      </Section>

      <Section title="6. Use the report to ask informed questions">
        <Prose>
          <p>Examples of useful follow-up questions include:</p>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {QUESTIONS.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </Prose>
      </Section>

      <Section title="Quick checklist">
        <ul className="max-w-3xl divide-y divide-line-soft rounded-lg border border-line bg-surface">
          {CHECKLIST.map((item) => (
            <li key={item} className="flex items-start gap-3 px-4 py-3">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 size-5 shrink-0 text-link"
              >
                <path d="M5 12.5 10 17.5 19 7" />
              </svg>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Final takeaway">
        <Prose>
          <p>
            Read the inspection date, judgement and supporting evidence together. Use the report to understand
            documented findings and prepare informed questions, rather than relying on a single label to make a
            decision.
          </p>
        </Prose>
      </Section>
    </>
  );
}
