// app/centres/[id]/page.tsx
import { CentreHighlights } from "@/components/centre/centre-highlights";
import { InspectionHistory } from "@/components/centre/inspection-history";
import { PromiseTrail } from "@/components/centre/promise-trail";
import { formatDate, getCentre, getCentreReports, type CentreDetail, type CentreReports } from "@/lib/centres";
import { formatEircode } from "@/lib/search";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

interface CentrePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ regulations?: string }>;
}

export async function generateMetadata({ params }: CentrePageProps) {
  const { id } = await params;
  const centre = await getCentre(id);
  return { title: centre ? centre.centre_name : "Nursing home not found" };
}

export default async function CentrePage({ params, searchParams }: CentrePageProps) {
  const { id } = await params;
  const { regulations } = await searchParams;
  const centre = await getCentre(id);
  if (!centre) notFound();
  const reports = await getCentreReports(id);

  return (
    <>
      <CentreHeader centre={centre} reports={reports} />

      {reports ? (
        <>
          <CentreHighlights highlights={reports.highlights} trails={reports.trails} />

          {reports.visitQuestions.length > 0 && (
            <section aria-labelledby="visit-h" className="grid gap-3 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-7 md:px-7">
              <h2 id="visit-h" className="font-serif text-xl font-semibold">
                Worth asking on a visit
              </h2>
              <ul className="flex list-disc flex-col gap-2 pl-5 leading-normal">
                {reports.visitQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </section>
          )}

          <InspectionHistory
            inspections={reports.inspections}
            history={reports.history}
            trails={reports.trails}
            showAll={regulations === "all"}
          />

          {reports.trails.map((trail) => (
            <PromiseTrail key={trail.regulation.number} trail={trail} inspections={reports.inspections} />
          ))}
        </>
      ) : (
        <section aria-labelledby="reports-h" className="rounded-lg border border-line bg-surface p-6">
          <h2 id="reports-h" className="font-serif text-xl font-semibold">
            Inspection reports
          </h2>
          <p className="mt-2 text-ink-muted">
            This home&apos;s inspection reports haven&apos;t been added to ClearCare yet. You can read them on{" "}
            <a href={centre.hiqa_url}>its page on hiqa.ie</a>.
          </p>
        </section>
      )}

      <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-ink-muted md:flex-row md:justify-between md:gap-10">
        <p>
          Contains information from HIQA inspection reports and the register of designated centres, reused under the
          Irish PSI licence (CC BY 4.0). ClearCare does not rate or recommend homes.
        </p>
        <p className="whitespace-nowrap">
          Source:{" "}
          <a href={centre.register_snapshot.url} className="text-ink-muted">
            HIQA register
          </a>
          , downloaded {formatDate(centre.register_snapshot.fetched_at)}
        </p>
      </div>
    </>
  );
}

function CentreHeader({ centre, reports }: { centre: CentreDetail; reports: CentreReports | null }) {
  const latest = reports?.inspections.at(-1);
  const first = reports?.inspections[0];

  return (
    <section className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
      <div className="flex min-w-0 flex-col gap-2.5">
        {/* TODO: Check the breadcrumb once the API is live. It only goes to the county, not back to the search the user came from. */}
        <div className="text-sm text-ink-muted">
          <Link href="/">Home</Link> ›{" "}
          <Link href={`/search?${new URLSearchParams({ county: centre.county })}`}>Co. {centre.county}</Link>
        </div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-5xl">{centre.centre_name}</h1>
        {/* As it is on the register: some addresses don't start with the name or end with the Eircode. */}
        <p className="text-ink-muted">{centre.address}</p>

        <dl className="mt-2.5 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
          <Fact label="Registered for">
            {centre.maximum_occupancy !== null ? `Up to ${centre.maximum_occupancy} residents` : "Not stated"}
            {/* The most residents HIQA allows, not free beds. */}
            <span className="block text-[13px] text-ink-muted">The most HIQA allows, not free beds</span>
          </Fact>
          <Fact label="County">Co. {centre.county}</Fact>
          {centre.eircode && (
            <Fact label="Eircode">
              <span className="font-mono">{formatEircode(centre.eircode)}</span>
            </Fact>
          )}
          <Fact label="HIQA centre ID">
            <span className="font-mono">{centre.centre_id}</span>
          </Fact>
          {latest && first && (
            <Fact label="Latest report">
              Inspected {formatDate(latest.date)}
              <span className="block text-[13px] text-ink-muted">
                Published {formatDate(latest.publishedDate)} · {reports.inspections.length}{" "}
                {reports.inspections.length === 1 ? "report" : "reports"} since {new Date(first.date).getUTCFullYear()}
              </span>
            </Fact>
          )}
        </dl>
      </div>

      <div className="flex flex-col gap-2.5 lg:min-w-60">
        {/* TODO: Link to the assistant once that page exists. */}
        <span
          aria-disabled="true"
          title="Coming soon"
          className="flex h-12 items-center justify-center rounded-md bg-link px-5 font-semibold text-surface opacity-50"
        >
          Ask about this home
        </span>
        {reports && (
          <a
            href={`/centres/${centre.centre_id}/record.csv`}
            className="flex h-11 items-center justify-center rounded-md border border-link bg-surface px-5 font-medium text-link no-underline hover:bg-surface-muted"
          >
            Download this record (CSV)
          </a>
        )}
        <a href={centre.hiqa_url} className="pt-1 text-center text-sm">
          Open this home on hiqa.ie
        </a>
      </div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
