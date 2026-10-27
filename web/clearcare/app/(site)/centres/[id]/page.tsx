// app/centres/[id]/page.tsx
import { CentreHighlights } from "@/components/centre/centre-highlights";
import { InspectionHistory } from "@/components/centre/inspection-history";
import { PromiseTrail } from "@/components/centre/promise-trail";
import { GuidesBand } from "@/components/guides/guide-ending";
import { Alert } from "@/components/layout/alert";
import { Breadcrumb, SEARCH_CRUMB } from "@/components/layout/breadcrumb";
import { ContactsBanner } from "@/components/layout/contacts-banner";
import { comingSoonClass, fullWidthClass } from "@/components/ui/classes";
import { Icon, type IconName } from "@/components/ui/icons";
import {
  centrePhone,
  formatDate,
  formatWeeklyPrice,
  getCentre,
  getCentreReports,
  HOME_TYPE_LABELS,
  type CentreDetail,
  type CentreReports,
} from "@/lib/centres";
import { getGuide } from "@/lib/guides";
import { formatEircode, unavailableMessage } from "@/lib/search";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

interface CentrePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ regulations?: string; inspections?: string }>;
}

export async function generateMetadata({ params }: CentrePageProps) {
  const { id } = await params;
  const lookup = await getCentre(id);
  if (lookup.status === "found") return { title: lookup.centre.centre_name };
  return { title: lookup.status === "not-found" ? "Nursing home not found" : "Nursing home record unavailable" };
}

export default async function CentrePage({ params, searchParams }: CentrePageProps) {
  const { id } = await params;
  const { regulations, inspections } = await searchParams;
  const lookup = await getCentre(id);
  if (lookup.status === "not-found") notFound();
  if (lookup.status === "unavailable") return <CentreUnavailable httpStatus={lookup.httpStatus} />;
  const { centre } = lookup;
  const reports = await getCentreReports(id);

  return (
    <>
      <CentreHero centre={centre} />

      <CentreFacts centre={centre} reports={reports} />

      {reports ? (
        <>
          <CentreHighlights highlights={reports.highlights} trails={reports.trails} />

          {reports.visitQuestions.length > 0 && (
            <section aria-labelledby="visit-h" className="grid gap-3 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-7 md:px-7">
              <h2 id="visit-h" className="font-heading text-xl font-semibold">
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
          />

          {reports.trails.map((trail) => (
            <PromiseTrail key={trail.regulation.number} trail={trail} inspections={reports.inspections} />
          ))}
        </>
      ) : (
        <section aria-labelledby="reports-h" className="rounded-lg border border-line bg-surface p-6">
          <h2 id="reports-h" className="font-heading text-xl font-semibold">
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

      {/* So nobody leaves a record unsure what it means or what to do next. */}
      <GuidesBand
        id="help-h"
        title="Making sense of this record"
        intro="Inspection reports use a lot of HIQA’s own language. Our guides explain it, and what to ask next."
        guides={RECORD_GUIDES}
      />

      {/* The negative bottom margin cancels the page's padding, so it meets the footer. */}
      <ContactsBanner className="-mb-6 md:-mb-10" />
    </>
  );
}


// The guides that help most with a record, in the order a family needs them.
const RECORD_GUIDES = [getGuide("reading-inspection-reports"), getGuide("choosing-a-nursing-home"), getGuide("fair-deal")];

// The top of the page, flush under the header as on the resources page: the breadcrumb and the
// home's name on a band of brand colour (brand-band, globals.css).
function CentreHero({ centre }: { centre: CentreDetail }) {
  return (
    <section aria-labelledby="centre-h" className={`${fullWidthClass} brand-band -mt-6 md:-mt-10`}>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
        <div className="flex min-w-0 flex-col gap-2.5">
          {/* Where the home sits in the site, the same however the user got here. */}
          <Breadcrumb
            trail={[
              SEARCH_CRUMB,
              { label: `Co. ${centre.county}`, href: `/search?${new URLSearchParams({ county: centre.county })}` },
            ]}
            current={centre.centre_name}
          />
          <h1 id="centre-h" className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-5xl">
            {centre.centre_name}
          </h1>
        </div>
      </div>
    </section>
  );
}

// The same look for each action button, so they line up in one column.
const actionButtonClass = "flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold";
const outlineButtonClass = `${actionButtonClass} border border-line bg-surface text-ink no-underline hover:border-primary hover:text-ink`;

function CentreActions({ centre, reports }: { centre: CentreDetail; reports: CentreReports | null }) {
  return (
    <div className="flex flex-col gap-2.5 lg:min-w-60">
      {/* TODO: Link to the assistant once that page exists. */}
      <span
        aria-disabled="true"
        title="Coming soon"
        className={`${actionButtonClass} ${comingSoonClass}`}
      >
        Ask about this home (coming soon)
      </span>
      {reports && (
        <a
          href={`/centres/${centre.centre_id}/record.csv`}
          download
          className={outlineButtonClass}
        >
          <Icon name="download" className="size-4" />
          Download this record as a spreadsheet
        </a>
      )}
      <a href={centre.hiqa_url} className={outlineButtonClass}>
        View on the HIQA website
      </a>
    </div>
  );
}

function CentreFacts({ centre, reports }: { centre: CentreDetail; reports: CentreReports | null }) {
  const latest = reports?.inspections.at(-1);
  const first = reports?.inspections[0];
  const eircode = centre.eircode ? formatEircode(centre.eircode) : null;
  // Most register addresses already end with the Eircode, so it only gets its own row when missing.
  const addressHasEircode = Boolean(centre.eircode && centre.address.replaceAll(" ", "").toUpperCase().includes(centre.eircode));
  const phone = centrePhone(centre.centre_phone);

  return (
    <section aria-labelledby="facts-h" className="flex flex-col gap-3">
      <h2 id="facts-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
        About this home
      </h2>
      {/* The details, with the actions beside them on wide screens and under them on narrow ones. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        {/* One box of label and value rows, like the centre details on hiqa.ie. White on the page
            background in the standard design; the adult-centred design adds a 3:1 edge. */}
        <dl className="w-full max-w-2xl rounded-lg bg-surface py-2 adult:border adult:border-line">
          <Fact label="HIQA centre ID" icon="id">
            <span className="font-mono">{centre.centre_id}</span>
          </Fact>
          <Fact label="County" icon="county">Co. {centre.county}</Fact>
          {/* As it is on the register: some addresses don't start with the name or end with the Eircode. */}
          <Fact label="Address" icon="address">{centre.address}</Fact>
          {eircode && !addressHasEircode && (
            <Fact label="Eircode" icon="email">
              <span className="font-mono">{eircode}</span>
            </Fact>
          )}
          {/* After the address, as on hiqa.ie. Only a single number gets a tap-to-call link. */}
          {phone && (
            <Fact label="Phone" icon="phone">
              {phone.tel ? (
                <a href={`tel:${phone.tel}`} className="tap-target">
                  {phone.text}
                </a>
              ) : (
                phone.text
              )}
            </Fact>
          )}
          <Fact label="Registered for" icon="beds">
            {centre.maximum_occupancy !== null ? `Up to ${centre.maximum_occupancy} residents` : "Not stated"}
            {/* The most residents HIQA allows, not free beds. */}
            <span className="block text-small text-ink-muted">HIQA&apos;s limit, not free beds</span>
          </Fact>
          {/* From the HSE price list the price came from. No row when there's no list for the home. */}
          {centre.home_type && <Fact label="Type of home" icon="home">{HOME_TYPE_LABELS[centre.home_type]}</Fact>}
          {/* No row from an API without prices (undefined); "Not available" when it has none for this home. */}
          {centre.contract_price !== undefined && (
            <Fact label="Full weekly cost" icon="cost">
              {centre.contract_price !== null ? (
                <>
                  {formatWeeklyPrice(centre.contract_price)} per week
                  <span className="block text-small text-ink-muted">
                    This does not include extra charges,{" "}
                    <Link href="/guides/fair-deal#what-does-fair-deal-cover" className="tap-target">
                      see here
                    </Link>
                    .
                  </span>
                  <span className="block text-small text-ink-muted">
                    With Fair Deal you pay your own contribution.{" "}
                    <Link href="/guides/fair-deal#how-much-will-you-pay" className="tap-target">
                      How much will you pay?
                    </Link>
                  </span>
                </>
              ) : (
                <>
                  Not available
                  <span className="block text-small text-ink-muted">Ask the home</span>
                </>
              )}
            </Fact>
          )}
          {latest && first && (
            <Fact label="Latest report" icon="report">
              Inspected {formatDate(latest.date)}
              <span className="block text-small text-ink-muted">
                {latest.publishedDate && `Published ${formatDate(latest.publishedDate)} · `}
                {reports.inspections.length}{" "}
                {reports.inspections.length === 1 ? "report" : "reports"} since {new Date(first.date).getUTCFullYear()}
              </span>
            </Fact>
          )}
        </dl>
        <CentreActions centre={centre} reports={reports} />
      </div>
      {/* TODO: Show these with the details once the API has them. */}
      <div className={`flex w-full max-w-2xl flex-col gap-1 px-4 py-3 ${comingSoonClass}`}>
        <h3 className="font-semibold text-ink">Coming soon</h3>
        <p>The home&apos;s care types, services and amenities, so you can see what it offers.</p>
      </div>
    </section>
  );
}

// The same message the search page shows when the data can't be read.
function CentreUnavailable({ httpStatus }: { httpStatus: number }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-ink-muted">
        <Link href="/" className="inline-block py-1 tap-target">
          Home
        </Link>
      </div>
      <Alert title="This record isn't available right now">{unavailableMessage(httpStatus)}</Alert>
    </div>
  );
}

// One row of the details. The icon helps the eye find a row; the label says the same in words.
function Fact({ label, icon, children }: { label: string; icon: IconName; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 px-4 py-2 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="flex items-center gap-2 font-medium text-ink-muted">
        <Icon name={icon} />
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
