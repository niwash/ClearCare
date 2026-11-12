// app/centres/[id]/inspections/page.tsx
// The home's inspection history: how each regulation was judged at each inspection, on a page of
// its own (CCARE-212). "Show all" for regulations and inspections stays in the address
// (?regulations=all, ?inspections=all), as it was on the one long page.
import { Band } from "@/components/centre/centre-band";
import { RecordPrintButton } from "@/components/centre/record-print";
import { InspectionHistory } from "@/components/centre/inspection-history";
import { sectionCardClass, sectionHeadingClass } from "@/components/centre/section-icon";
import { centreMetadata, centrePath, getCentreRecord } from "@/lib/centre-record";
import { notFound } from "next/navigation";

interface InspectionsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ regulations?: string; inspections?: string }>;
}

export async function generateMetadata({ params }: InspectionsPageProps) {
  return centreMetadata((await params).id, "inspections");
}

export default async function InspectionsPage({ params, searchParams }: InspectionsPageProps) {
  const { id } = await params;
  const { regulations, inspections } = await searchParams;
  // The layout has already answered a home that isn't found or can't be read.
  const record = await getCentreRecord(id);
  if (record.status !== "found") notFound();
  const { centre, reports } = record;

  return (
    <Band tint="stone">
      {reports ? (
        <InspectionHistory
          inspections={reports.inspections}
          history={reports.history}
          trails={reports.trails}
          showAll={regulations === "all"}
          showAllInspections={inspections === "all"}
          trailsHref={centrePath(id, "next-steps")}
        />
      ) : (
        // The heading on the band and the message in a card, as the other sections have.
        <section aria-labelledby="reports-h" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <h2 id="reports-h" className={sectionHeadingClass}>
              Inspection reports
            </h2>
            <RecordPrintButton />
          </div>
          <p className={`${sectionCardClass} p-6 text-ink-muted`}>
            We haven&apos;t added this home&apos;s reports yet. Read them on <a href={centre.hiqa_url}>hiqa.ie</a>.
          </p>
        </section>
      )}
    </Band>
  );
}
