// app/centres/[id]/questions/page.tsx
// What to ask (CCARE-212): the questions to take on a visit, in one list a family can print or keep
// on a phone. First those about this home, from how each story on What happened next ended
// (askTheHome): one question for the stories that ended the same way, with their topics under it,
// each linked to its story so it keeps its context; then a few that are good to ask any home, with
// the guide for more. The record otherwise ends on judgements; this page
// ends it on what the family can do.
import { Band } from "@/components/centre/centre-band";
import { askTheHome, inspectionDate, OutcomePill, trailOutcome, type Outcome } from "@/components/centre/finding-bits";
import { JUDGEMENT_LABELS, JudgementIcon } from "@/components/centre/judgement-icon";
import { sectionCardClass, sectionHeadingClass } from "@/components/centre/section-icon";
import { PrintButton } from "@/components/ui/print-button";
import { centreMetadata, centrePath, getCentreRecord } from "@/lib/centre-record";
import { trailAnchor, type Judgement, type PromiseTrail } from "@/lib/centres";
import Link from "next/link";
import { notFound } from "next/navigation";

interface QuestionsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: QuestionsPageProps) {
  return centreMetadata((await params).id, "questions");
}

// Worth asking any home, whatever its reports say: staffing, care plans, daily life, visiting, cost
// and complaints, the things families most often wish they had asked. The guide has more.
const ANY_HOME = [
  "How many staff are on duty during the day and at night, and is a nurse always there?",
  "How are residents and their families involved in planning their care?",
  "What does a typical day look like, and can residents choose how they spend it?",
  "When can family visit, and can they join in meals or activities?",
  "What do you charge on top of the weekly fee?",
  "How do you handle complaints, and what changed after the last one?",
];

// How the regulation was last judged, as its story tells it: at the next inspection that judged it,
// or else when it was found. A reminder beside each topic of how serious it was.
function latestJudgement({ finding, followUp }: PromiseTrail): Judgement {
  return followUp && followUp.judgement !== "not-assessed" && !followUp.printedJudgement ? followUp.judgement : finding.judgement;
}

export default async function QuestionsPage({ params }: QuestionsPageProps) {
  const { id } = await params;
  // The layout has already answered a home that isn't found or can't be read.
  const record = await getCentreRecord(id);
  if (record.status !== "found") notFound();
  const { centre, reports } = record;

  // One question for each story that leaves something to ask: none once it was put right.
  // Stories that end the same way share one question, asked once with their topics under it, rather
  // than the same words repeated for each. Grouped by the question for one topic, which carries the
  // outcome and, for one still waiting, the month of its inspection.
  const groups = new Map<string, { outcome: Outcome; date?: string; trails: PromiseTrail[] }>();
  for (const trail of reports?.trails ?? []) {
    const outcome = trailOutcome(trail);
    const date = inspectionDate(reports!.inspections, trail.finding.inspectionId);
    const key = askTheHome(outcome, date);
    if (!key) continue;
    const group = groups.get(key) ?? { outcome, date, trails: [] };
    group.trails.push(trail);
    groups.set(key, group);
  }
  const about = [...groups.values()].map((group) => ({
    ...group,
    question: askTheHome(group.outcome, group.date, group.trails.length > 1)!,
  }));

  return (
    <Band tint="blue">
      <section aria-labelledby="questions-h" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="flex max-w-3xl flex-col gap-1.5">
            <h2 id="questions-h" className={sectionHeadingClass}>
              What to ask
            </h2>
            <p className="text-ink">
              Questions to take with you when you visit or call {centre.centre_name}. Print them, or keep this page open
              on your phone.
            </p>
          </div>
          <PrintButton />
        </div>

        {about.length > 0 && (
          <div className={`${sectionCardClass} flex flex-col gap-1 p-5 md:p-7`}>
            <h3 className="font-heading text-xl font-semibold text-ink">About what the inspectors found</h3>
            <ol className="mt-3 flex flex-col divide-y divide-line-soft">
              {about.map(({ outcome, question, trails }, index) => (
                <li key={question} className="flex gap-4 py-5 first:pt-1 last:pb-0">
                  <span aria-hidden className="w-6 shrink-0 pt-0.5 font-heading text-lg font-semibold text-ink-muted">
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    <p className="text-lg leading-relaxed text-ink">{question}</p>
                    {/* The topics it's about, each to its story, with how they ended. */}
                    <div className="flex flex-wrap items-center gap-2">
                      <OutcomePill outcome={outcome} />
                      <span className="text-sm text-ink-muted">about</span>
                      {trails.map((trail) => {
                        const judgement = latestJudgement(trail);
                        return (
                          <Link
                            key={trail.regulation.number}
                            href={`${centrePath(id, "next-steps")}#${trailAnchor(trail.regulation)}`}
                            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm text-ink no-underline hover:border-primary hover:text-ink adult:rounded-md adult:underline print:min-h-0 print:border-0 print:px-0"
                          >
                            <JudgementIcon judgement={judgement} size={13} />
                            <span className="font-semibold">{trail.regulation.title}</span>
                            <span className="text-ink-muted">{JUDGEMENT_LABELS[judgement]}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className={`${sectionCardClass} flex flex-col gap-1 p-5 md:p-7`}>
          <h3 className="font-heading text-xl font-semibold text-ink">
            {about.length > 0 ? "Good to ask any home" : "Good questions to ask"}
          </h3>
          <p className="text-sm text-ink-muted">
            {about.length > 0
              ? "Whatever its reports say."
              : "Nothing in this home's reports needs a question of its own, but these are worth asking any home."}
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {ANY_HOME.map((question) => (
              <li key={question} className="flex items-start gap-3 leading-relaxed text-ink">
                <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-ink-muted" />
                {question}
              </li>
            ))}
          </ul>
          <Link href="/guides/choosing-a-nursing-home" className="mt-4 self-start text-sm font-semibold tap-target print:hidden">
            More questions in our guide <span aria-hidden>→</span>
          </Link>
        </div>
      </section>
    </Band>
  );
}
