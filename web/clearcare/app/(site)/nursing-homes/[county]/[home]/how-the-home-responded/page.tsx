// app/(site)/nursing-homes/[county]/[home]/how-the-home-responded/page.tsx
// How the home responded: for each highlighted regulation, what the inspector found, what the provider
// said they would do, and when the regulation was next judged (CCARE-207), on a page of its own
// (CCARE-212). Issues found and the grid of judgments link to a trail by its id, from their own
// pages, and SectionAccordion opens it on arrival.
import { Band } from "@/components/centre/centre-band";
import { RecordPrintButton } from "@/components/centre/record-print";
import { PromiseTrail } from "@/components/centre/promise-trail";
import { emptyReason, NothingToFlag } from "@/components/centre/nothing-to-flag";
import { sectionHeadingClass } from "@/components/centre/section-icon";
import { SectionAccordion } from "@/components/guides/section-accordion";
import { getCentreRecord, homeFromParams, homeMetadata, type HomeParams } from "@/lib/centre-record";
import { homePath } from "@/lib/home-address";
import { notFound } from "next/navigation";

interface NextStepsPageProps {
  params: HomeParams;
}

export async function generateMetadata({ params }: NextStepsPageProps) {
  return homeMetadata(params, "how-the-home-responded");
}

export default async function NextStepsPage({ params }: NextStepsPageProps) {
  const id = await homeFromParams(params, "how-the-home-responded");
  // The layout has already answered a home that isn't found or can't be read.
  const record = await getCentreRecord(id);
  if (record.status !== "found") notFound();
  const { centre, reports, findingsRead } = record;
  const trails = reports?.trails ?? [];

  return (
    <Band tint="sage">
      {/* One trail per highlighted regulation, closed to begin with so the page stays short. Any
          number can be open, so a family can read two together and compare them. */}
      <section aria-labelledby="trails-h" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <h2 id="trails-h" className={sectionHeadingClass}>
              How the home responded
            </h2>
            <RecordPrintButton />
          </div>
          <p className="max-w-3xl text-ink">
            For each of the issues found: what the inspector found, what the home said it would do, and how the
            regulation was judged the next time an inspection looked at it.
          </p>
        </div>
        {reports && trails.length > 0 ? (
          <>
            <SectionAccordion />
            {trails.map((trail) => (
              <PromiseTrail key={trail.regulation.number} trail={trail} inspections={reports.inspections} highlightsHref={homePath(centre, "issues-found")} questionsHref={homePath(centre, "what-to-ask")} />
            ))}
          </>
        ) : (
          // The tab is always there, so the page says why it's empty (NothingToFlag).
          <NothingToFlag
            reason={emptyReason(Boolean(reports?.inspections.length), findingsRead)}
            page="how-the-home-responded"
            inspectionsHref={homePath(centre, "inspections")}
            visitHref={homePath(centre, "what-to-ask")}
            hiqaUrl={centre.hiqa_url}
          />
        )}
      </section>
    </Band>
  );
}
