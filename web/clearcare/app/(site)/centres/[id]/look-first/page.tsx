// app/centres/[id]/look-first/page.tsx
// What to look at first: the regulations a family should read about before anything else, each in
// the inspector's or the provider's own words (CCARE-207), on a page of its own (CCARE-212). Each
// links to its trail on What happened next, which links back here.
import { Band } from "@/components/centre/centre-band";
import { CentreHighlights } from "@/components/centre/centre-highlights";
import { sectionCardClass, sectionHeadingClass } from "@/components/centre/section-icon";
import { centreMetadata, centrePath, getCentreRecord } from "@/lib/centre-record";
import { notFound } from "next/navigation";

interface LookFirstPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: LookFirstPageProps) {
  return centreMetadata((await params).id, "look-first");
}

export default async function LookFirstPage({ params }: LookFirstPageProps) {
  const { id } = await params;
  // The layout has already answered a home that isn't found or can't be read.
  const record = await getCentreRecord(id);
  if (record.status !== "found") notFound();
  const { reports } = record;

  return (
    <Band tint="gold">
      {reports && reports.highlights.length > 0 ? (
        <CentreHighlights highlights={reports.highlights} trails={reports.trails} trailsHref={centrePath(id, "next-steps")} />
      ) : (
        // The tab isn't shown without highlights, but the address can still be opened.
        <section aria-labelledby="first-h" className="flex flex-col gap-3">
          <h2 id="first-h" className={sectionHeadingClass}>
            What to look at first
          </h2>
          <p className={`${sectionCardClass} p-6 text-ink-muted`}>
            No regulation of this home stands out in its reports. Its inspection history has how every regulation was
            judged.
          </p>
        </section>
      )}
    </Band>
  );
}
