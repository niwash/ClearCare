// app/(site)/nursing-homes/[county]/(home)/[home]/issues-found/page.tsx
// Issues found: the regulations a family should read about before anything else, each in
// the inspector's or the provider's own words (CCARE-207), on a page of its own (CCARE-212). Each
// links to its trail on How the home responded, which links back here.
import { Band } from "@/components/centre/centre-band";
import { RecordPrintButton } from "@/components/centre/record-print";
import { CentreHighlights } from "@/components/centre/centre-highlights";
import { emptyReason, NothingToFlag } from "@/components/centre/nothing-to-flag";
import { sectionHeadingClass } from "@/components/centre/section-icon";
import { getCentreRecord, homeFromParams, homeMetadata, type HomeParams } from "@/lib/centre-record";
import { homePath } from "@/lib/home-address";
import { formatDate } from "@/lib/centres";
import { notFound } from "next/navigation";

interface LookFirstPageProps {
  params: HomeParams;
}

export async function generateMetadata({ params }: LookFirstPageProps) {
  return homeMetadata(params, "issues-found");
}

export default async function LookFirstPage({ params }: LookFirstPageProps) {
  const id = await homeFromParams(params, "issues-found");
  // The layout has already answered a home that isn't found or can't be read.
  const record = await getCentreRecord(id);
  if (record.status !== "found") notFound();
  const { centre, reports, findingsRead, hasCompliancePlan } = record;
  // The inspection Issues found's rules go by (addFindings): the latest that judged regulations.
  const latestJudged = reports?.inspections.filter((inspection) => inspection.regulationJudgements).at(-1);

  return (
    <Band tint="gold">
      {reports && reports.highlights.length > 0 ? (
        <CentreHighlights
          highlights={reports.highlights}
          trails={reports.trails}
          inspections={reports.inspections}
          trailsHref={homePath(centre, "how-the-home-responded")}
          inspectionsHref={homePath(centre, "inspections")}
        />
      ) : (
        // The tab is always there, so the page says why it's empty (NothingToFlag).
        <section aria-labelledby="first-h" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <h2 id="first-h" className={sectionHeadingClass}>
              Issues found
            </h2>
            <RecordPrintButton />
          </div>
          <NothingToFlag
            reason={emptyReason(Boolean(reports?.inspections.length), findingsRead)}
            page="issues-found"
            inspectionsHref={homePath(centre, "inspections")}
            visitHref={homePath(centre, "what-to-ask")}
            hiqaUrl={centre.hiqa_url}
            latestInspection={latestJudged && formatDate(latestJudged.date)}
            hasCompliancePlan={hasCompliancePlan}
          />
        </section>
      )}
    </Band>
  );
}
