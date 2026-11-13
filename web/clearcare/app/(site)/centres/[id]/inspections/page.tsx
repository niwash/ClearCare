// app/centres/[id]/inspections/page.tsx
// The home's inspection history, on a page of its own (CCARE-212): the timeline of what has happened
// at the home (CCARE-235), then a grid of how each regulation was judged at each inspection.
import { Band } from "@/components/centre/centre-band";
import { RecordPrintButton } from "@/components/centre/record-print";
import { InspectionHistory } from "@/components/centre/inspection-history";
import { sectionCardClass, sectionHeadingClass } from "@/components/centre/section-icon";
import { Timeline } from "@/components/centre/timeline";
import { formatDate } from "@/lib/centres";
import { centreMetadata, centrePath, getCentreRecord } from "@/lib/centre-record";
import { missingReportsNote } from "@/lib/events";
import { notFound } from "next/navigation";

interface InspectionsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: InspectionsPageProps) {
  return centreMetadata((await params).id, "inspections");
}

export default async function InspectionsPage({ params }: InspectionsPageProps) {
  const { id } = await params;
  // The layout has already answered a home that isn't found or can't be read.
  const record = await getCentreRecord(id);
  if (record.status !== "found") notFound();
  const { centre, reports, events, hiqaCheckedAt } = record;
  // "none-published": HIQA's page for the home has been read and lists no report, so there is none
  // to add: a newly registered home, mostly. Nothing is said under a timeline that shows the reports
  // HIQA published.
  const missingReports = missingReportsNote(events, hiqaCheckedAt);

  return (
    <Band tint="stone">
      {reports ? (
        <InspectionHistory
          inspections={reports.inspections}
          history={reports.history}
          trails={reports.trails}
          events={events}
          trailsHref={centrePath(id, "next-steps")}
        />
      ) : (
        // The heading on the band and the message in a card, as the other sections have. The timeline
        // still shows over it: a home with no report has at least its registration.
        <section aria-labelledby="reports-h" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <h2 id="reports-h" className={sectionHeadingClass}>
              Inspection reports
            </h2>
            <RecordPrintButton />
          </div>
          {events && events.length > 0 && (
            <div className={`${sectionCardClass} px-4 py-5 md:px-7`}>
              <Timeline events={events} />
            </div>
          )}
          {missingReports === "none-published" && (
            <p className={`${sectionCardClass} p-6 text-ink-muted`}>
              HIQA has not published an inspection report for this home yet.
              {centre.registration && (
                <>
                  {" "}
                  It was registered on{" "}
                  <time dateTime={centre.registration.registered_from}>{formatDate(centre.registration.registered_from)}</time>.
                </>
              )}{" "}
              See its page on <a href={centre.hiqa_url}>hiqa.ie</a>.
            </p>
          )}
          {missingReports === "not-added" && (
            <p className={`${sectionCardClass} p-6 text-ink-muted`}>
              We haven&apos;t added this home&apos;s reports yet. Read them on <a href={centre.hiqa_url}>hiqa.ie</a>.
            </p>
          )}
        </section>
      )}
    </Band>
  );
}
