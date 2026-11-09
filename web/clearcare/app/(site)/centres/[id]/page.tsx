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
import { sectionHeadingClass, sectionScrollMargin } from "@/components/centre/section-icon";
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
    <div className="flex flex-col gap-2.5 lg:w-80 lg:shrink-0">
      <CentrePhoto className="mb-2 hidden lg:flex" />
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

function CentreFacts({ centre, reports }: { centre: CentreDetail; reports: CentreReports | null }) {
  const latest = reports?.inspections.at(-1);
  const first = reports?.inspections[0];
  const eircode = centre.eircode ? formatEircode(centre.eircode) : null;
  // Most register addresses already end with the Eircode, so it only gets its own row when missing
  // or printed with an O for 0 (A98 C2CO), since the row is then the only place it shows right.
  const addressHasEircode = Boolean(centre.eircode && centre.address.replaceAll(" ", "").toUpperCase().includes(centre.eircode));
  const phone = centrePhone(centre.centre_phone);

  return (
    <section id="about" aria-labelledby="facts-h" className="flex flex-col gap-3">
      <h2 id="facts-h" className={sectionHeadingClass}>
        About this home
      </h2>
      {/* The details, with the photo and actions beside them on wide screens. On narrow ones the photo
          comes first and the actions after the details. Only one of the two photos is shown at a time,
          so screen readers meet it once. */}
      <CentrePhoto className="max-w-2xl lg:hidden" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        {/* One box of label and value rows, like the centre details on hiqa.ie. What the home offers
            is the next section, on a band of its own. White on the page background in the standard
            design; the adult-centred design adds a 3:1 edge. */}
        <div className="w-full max-w-2xl rounded-2xl border border-line-soft bg-surface shadow-sm adult:rounded-lg adult:border-line adult:shadow-none">
          <dl className="py-2">
            <Fact label="HIQA centre ID" icon="id">
              <span className="font-mono">{centre.centre_id}</span>
            </Fact>
            <Fact label="County" icon="county">Co. {centre.county}</Fact>
            {/* As it is on the register: some addresses don't start with the name or end with the Eircode. */}
            <Fact label="Address" icon="address">{centre.address}</Fact>
            {eircode && !addressHasEircode && (
              <Fact label="Eircode" icon="eircode">
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
              {/* The most residents HIQA allows, not free beds. Where to ask about those is said here, where
                  the question comes up, rather than on the search page (CCARE-179). */}
              <span className="block text-small text-ink-muted">HIQA&apos;s limit, not free beds.</span>
              <span className="block text-small text-ink-muted">
                To ask about a free bed, contact the home
                {phone?.tel ? (
                  <>
                    {" "}
                    on{" "}
                    <a href={`tel:${phone.tel}`} className="tap-target">
                      {phone.text}
                    </a>
                  </>
                ) : (
                  " directly"
                )}
                .
              </span>
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
                <Link href={centrePath(centre.centre_id, "inspections")} className="tap-target">
                  See the inspection history
                </Link>
              </Fact>
            )}
          </dl>
          {/* Where the record comes from, as the box's footnote: beside the facts it sources, rather
              than on a strip of its own between the page's coloured bands. */}
          <div className="flex flex-col gap-1 border-t border-line-soft px-4 py-3 text-small leading-relaxed text-ink-muted adult:border-line">
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
        </div>
        <CentreActions centre={centre} reports={reports} />
      </div>
    </section>
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
