// app/centres/[id]/page.tsx
// A home's record: the overview (CCARE-212). The facts, what the home offers and what to ask on a
// visit, the things a family needs before anything else. What to look at first, the inspection
// history and what happened next have pages of their own (look-first/, inspections/, next-steps/),
// with the tabs in the layout.
import { Band } from "@/components/centre/centre-band";
import { CentreAmenitiesSection } from "@/components/centre/centre-amenities";
import { CentrePhoto } from "@/components/centre/centre-photo";
import { CompareButton } from "@/components/compare/compare-button";
import { ShortlistDrawer } from "@/components/compare/shortlist-drawer";
import { sectionCardClass, sectionHeadingClass, sectionScrollMargin } from "@/components/centre/section-icon";
import { Icon, type IconName } from "@/components/ui/icons";
import {
  centrePhone,
  formatDate,
  formatWeeklyPrice,
  HOME_TYPE_LABELS,
  type CentreDetail,
  type CentreReports,
} from "@/lib/centres";
import { centreMetadata, centrePath, getCentreRecord } from "@/lib/centre-record";
import { formatEircode } from "@/lib/search";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

interface CentrePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CentrePageProps) {
  return centreMetadata((await params).id);
}

export default async function CentrePage({ params }: CentrePageProps) {
  const { id } = await params;
  // The layout has already answered a home that isn't found or can't be read.
  const record = await getCentreRecord(id);
  if (record.status !== "found") notFound();
  const { centre, reports, amenities } = record;

  return (
    <>
      <Band tint="page">
        <CentreFacts centre={centre} reports={reports} />
      </Band>

      {/* On a band of its own, between the facts and the visit questions (CCARE-212). */}
      <Band tint="stone">
        <CentreAmenitiesSection
          amenities={amenities}
          reportUrl={reports?.inspections.find((inspection) => inspection.id === String(amenities?.report_id))?.reportUrl}
        />
      </Band>

      {reports && reports.visitQuestions.length > 0 && (
        <Band tint="page">
          {/* On the warm band colour, as the part of the record that turns what HIQA found into what
              the family can do next (CCARE-179). */}
          <section
            id="visit"
            aria-labelledby="visit-h"
            className={`grid ${sectionScrollMargin} gap-3 rounded-2xl bg-warm p-5 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-7 md:p-7 adult:rounded-lg adult:border adult:border-line`}
          >
            <h2 id="visit-h" className="flex items-start gap-3 font-heading text-xl font-semibold">
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-tint-rose text-on-tint-rose adult:bg-surface">
                <Icon name="talk" className="size-4" />
              </span>
              Worth asking on a visit
            </h2>
            <ul className="flex list-disc flex-col gap-2 pl-5 leading-normal">
              {reports.visitQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </section>
        </Band>
      )}
    </>
  );
}

// The same look for each action button, so they line up in one column.
const actionButtonClass = "flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold";
const outlineButtonClass = `${actionButtonClass} border border-line bg-surface text-ink no-underline hover:border-primary hover:text-ink`;

function CentreActions({ centre, reports }: { centre: CentreDetail; reports: CentreReports | null }) {
  return (
    <div className="flex flex-col gap-2.5">
      {/* TODO: An "Ask about this home" button, linking to the assistant once that page exists.
          Taken out until then (CCARE-164). */}
      {/* Once the list is full, the button says so under itself: the shortlist is in a panel that
          may be closed. */}
      <CompareButton
        home={{ id: centre.centre_id, name: centre.centre_name }}
        className={`${actionButtonClass} w-full`}
      />
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
      {/* The homes saved so far, so the family can see where this one fits and go on to compare
          them: a button that opens them in a panel from the side, as on the search page, rather than
          a box that made the column taller than the details beside it (CCARE-212). */}
      <div className="mt-1">
        <ShortlistDrawer currentId={centre.centre_id} />
      </div>
    </div>
  );
}

// The facts in small cards by what a family asks about them, rather than one long box of rows
// (CCARE-212): how to reach the home beside the photo, then its size, its cost and its inspections.
function CentreFacts({ centre, reports }: { centre: CentreDetail; reports: CentreReports | null }) {
  const latest = reports?.inspections.at(-1);
  const first = reports?.inspections[0];
  const eircode = centre.eircode ? formatEircode(centre.eircode) : null;
  // Most register addresses already end with the Eircode, so it only gets its own row when missing
  // or printed with an O for 0 (A98 C2CO), since the row is then the only place it shows right.
  const addressHasEircode = Boolean(centre.eircode && centre.address.replaceAll(" ", "").toUpperCase().includes(centre.eircode));
  const phone = centrePhone(centre.centre_phone);
  const phoneLink = phone?.tel ? (
    <a href={`tel:${phone.tel}`} className="tap-target">
      {phone.text}
    </a>
  ) : (
    phone?.text
  );

  return (
    <section id="about" aria-labelledby="facts-h" className="flex flex-col gap-4">
      <h2 id="facts-h" className={sectionHeadingClass}>
        About this home
      </h2>

      {/* The photo takes most of the width, as the first thing a family looks at. Beside it on wide
          screens, how to reach the home and the actions, in a wider column than the buttons need so the
          photo is not too big; it is as tall as that column, so the two end level. On narrow screens
          they follow the photo. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6">
        <CentrePhoto className="lg:aspect-auto lg:h-full lg:min-h-80" />
        <div className="flex flex-col gap-4">
          <FactCard title="Contact" icon="address">
            {/* As it is on the register: some addresses don't start with the name or end with the Eircode. */}
            <Fact label="Address">{centre.address}</Fact>
            {eircode && !addressHasEircode && (
              <Fact label="Eircode">
                <span className="font-mono">{eircode}</span>
              </Fact>
            )}
            {/* Only a single number gets a tap-to-call link. */}
            {phone && <Fact label="Phone">{phoneLink}</Fact>}
            <Fact label="County">Co. {centre.county}</Fact>
          </FactCard>
          <CentreActions centre={centre} reports={reports} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <FactCard title="Size and type" icon="beds">
          <Fact label="Registered for">
            {centre.maximum_occupancy !== null ? `Up to ${centre.maximum_occupancy} residents` : "Not stated"}
            {/* The most residents HIQA allows, not free beds. Where to ask about those is said here, where
                the question comes up, rather than on the search page (CCARE-179). */}
            <Note>HIQA&apos;s limit, not free beds.</Note>
            <Note>
              To ask about a free bed, contact the home
              {phone?.tel ? <> on {phoneLink}</> : " directly"}.
            </Note>
          </Fact>
          {/* From the HSE price list the price came from. No row when there's no list for the home. */}
          {centre.home_type && <Fact label="Type of home">{HOME_TYPE_LABELS[centre.home_type]}</Fact>}
        </FactCard>

        {/* No card from an API without prices (undefined); "Not available" when it has none for this home. */}
        {centre.contract_price !== undefined && (
          <FactCard title="Cost" icon="cost">
            <Fact label="Full weekly cost">
              {centre.contract_price !== null ? (
                <>
                  {formatWeeklyPrice(centre.contract_price)} per week
                  <Note>
                    This does not include extra charges,{" "}
                    <Link href="/guides/fair-deal#what-does-fair-deal-cover" className="tap-target">
                      see here
                    </Link>
                    .
                  </Note>
                  <Note>
                    With Fair Deal you pay your own contribution.{" "}
                    <Link href="/guides/fair-deal#how-much-will-you-pay" className="tap-target">
                      How much will you pay?
                    </Link>
                  </Note>
                </>
              ) : (
                <>
                  Not available
                  <Note>Ask the home</Note>
                </>
              )}
            </Fact>
          </FactCard>
        )}

        <FactCard title="Inspections" icon="report">
          {latest && first && (
            <Fact label="Latest report">
              Inspected {formatDate(latest.date)}
              <Note>
                {latest.publishedDate && `Published ${formatDate(latest.publishedDate)} · `}
                {reports.inspections.length} {reports.inspections.length === 1 ? "report" : "reports"} since{" "}
                {new Date(first.date).getUTCFullYear()}
              </Note>
              <Link href={centrePath(centre.centre_id, "inspections")} className="tap-target">
                See the inspection history
              </Link>
            </Fact>
          )}
          <Fact label="HIQA centre ID">
            <span className="font-mono">{centre.centre_id}</span>
          </Fact>
        </FactCard>
      </div>

      {/* Where the record comes from, under the facts it sources. */}
      <div className="flex max-w-3xl flex-col gap-1 text-small leading-relaxed text-ink-muted">
        <p>
          Source:{" "}
          <a href={centre.register_snapshot.url} className="text-ink-muted">
            HIQA register
          </a>
          , downloaded {formatDate(centre.register_snapshot.fetched_at)}.
        </p>
        <p>
          Uses HIQA inspection reports and register data under the Irish PSI licence (CC BY 4.0). ClearCare does not
          rate or recommend homes.
        </p>
      </div>
    </section>
  );
}

// One card of facts: a heading with an icon, then label-over-value rows, which fit a narrow card
// better than label-beside-value. The icon helps the eye find a card; the heading says it in words.
function FactCard({ title, icon, children }: { title: string; icon: IconName; children: ReactNode }) {
  return (
    <div className={`${sectionCardClass} flex flex-col gap-3 p-4 md:p-5`}>
      <h3 className="flex items-center gap-2 font-semibold text-ink">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-tint-sage text-on-tint-sage adult:bg-surface-muted adult:text-ink">
          <Icon name={icon} className="size-4" />
        </span>
        {title}
      </h3>
      <dl className="flex flex-col gap-3">{children}</dl>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-small font-medium text-ink-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <span className="block text-small text-ink-muted">{children}</span>;
}
