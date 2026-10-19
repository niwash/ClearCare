// app/centres/[id]/page.tsx
import { CentreHighlights } from "@/components/centre/centre-highlights";
import { InspectionHistory } from "@/components/centre/inspection-history";
import { PromiseTrail } from "@/components/centre/promise-trail";
import { Alert } from "@/components/layout/alert";
import { comingSoonClass } from "@/components/ui/classes";
import { formatDate, getCentre, getCentreReports, type CentreDetail, type CentreReports } from "@/lib/centres";
import { formatEircode, searchHref, unavailableMessage } from "@/lib/search";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

interface CentrePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ regulations?: string; inspections?: string; from?: string }>;
}

export async function generateMetadata({ params }: CentrePageProps) {
  const { id } = await params;
  const lookup = await getCentre(id);
  if (lookup.status === "found") return { title: lookup.centre.centre_name };
  return { title: lookup.status === "not-found" ? "Nursing home not found" : "Nursing home record unavailable" };
}

export default async function CentrePage({ params, searchParams }: CentrePageProps) {
  const { id } = await params;
  const { regulations, inspections, from } = await searchParams;
  const lookup = await getCentre(id);
  if (lookup.status === "not-found") notFound();
  if (lookup.status === "unavailable") return <CentreUnavailable httpStatus={lookup.httpStatus} />;
  const { centre } = lookup;
  const reports = await getCentreReports(id);

  return (
    <>
      <CentreHeader centre={centre} reports={reports} from={from} />

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
            showAllInspections={inspections === "all"}
            from={from}
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
            We haven&apos;t added this home&apos;s reports yet. Read them on <a href={centre.hiqa_url}>hiqa.ie</a>.
          </p>
        </section>
      )}

      <div className="flex flex-col gap-2 text-small leading-relaxed text-ink-muted md:flex-row md:justify-between md:gap-10">
        <p>
          Uses HIQA inspection reports and register data under the Irish PSI licence (CC BY 4.0). ClearCare does not
          rate or recommend homes.
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

function CentreHeader({ centre, reports, from }: { centre: CentreDetail; reports: CentreReports | null; from?: string }) {
  const latest = reports?.inspections.at(-1);
  const first = reports?.inspections[0];

  return (
    <section className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
      <div className="flex min-w-0 flex-col gap-2.5">
        {/* "Search results" goes back to the search the user came from, or to an empty search
            when there isn't one (a shared link, the start page). */}
        <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
          <ol className="flex flex-wrap gap-x-1.5">
            <li>
              <Link href="/home" className="inline-block py-1 tap-target">
                Home
              </Link>{" "}
              <span aria-hidden>›</span>
            </li>
            <li>
              <Link href={from !== undefined ? searchHref(from) : "/search"} className="inline-block py-1 tap-target">
                Search results
              </Link>{" "}
              <span aria-hidden>›</span>
            </li>
            <li>
              <Link href={`/search?${new URLSearchParams({ county: centre.county })}`} className="inline-block py-1 tap-target">
                Co. {centre.county}
              </Link>{" "}
              <span aria-hidden>›</span>
            </li>
            {/* The same padding as the links, so the name lines up with them. */}
            <li aria-current="page" className="py-1 tap-target">
              {centre.centre_name}
            </li>
          </ol>
        </nav>
        <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-5xl">{centre.centre_name}</h1>
        {/* As it is on the register: some addresses don't start with the name or end with the Eircode. */}
        <p className="text-ink-muted">{centre.address}</p>

        <dl className="mt-2.5 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
          <Fact label="Registered for">
            {centre.maximum_occupancy !== null ? `Up to ${centre.maximum_occupancy} residents` : "Not stated"}
            {/* The most residents HIQA allows, not free beds. */}
            <span className="block text-small text-ink-muted">HIQA&apos;s limit, not free beds</span>
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
              <span className="block text-small text-ink-muted">
                {latest.publishedDate && `Published ${formatDate(latest.publishedDate)} · `}
                {reports.inspections.length}{" "}
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
          className={`flex h-12 items-center justify-center px-5 font-semibold ${comingSoonClass}`}
        >
          Ask about this home (coming soon)
        </span>
        {reports && (
          <a
            href={`/centres/${centre.centre_id}/record.csv`}
            download
            className="flex min-h-12 items-center gap-3 rounded-md border border-line bg-surface px-4 py-3 font-semibold hover:border-primary"
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
            Download spreadsheet
          </a>
        )}
        <a href={centre.hiqa_url} className="pt-1 text-center text-sm adult:flex adult:min-h-11 adult:items-center adult:justify-center adult:pt-0">
          View on hiqa.ie
        </a>
      </div>
    </section>
  );
}

// The same message the search page shows when the data can't be read.
function CentreUnavailable({ httpStatus }: { httpStatus: number }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-ink-muted">
        <Link href="/home" className="inline-block py-1 tap-target">
          Home
        </Link>
      </div>
      <Alert title="This record isn't available right now">{unavailableMessage(httpStatus)}</Alert>
    </div>
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
