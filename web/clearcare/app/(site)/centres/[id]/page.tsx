// app/centres/[id]/page.tsx
// A home's record: the overview (CCARE-212). The extra conditions on its registration when it has
// any and what changed at it in the last six months (CCARE-235), the facts and what the home offers,
// the things a family needs before anything else, and a pointer to what to ask on a visit. What to
// look at first, what happened next, the inspection history and what to ask have pages of their own
// (look-first/, next-steps/, inspections/, questions/), with the tabs in the layout.
import { Band } from "@/components/centre/centre-band";
import { RecordPrintButton } from "@/components/centre/record-print";
import { CentreAmenitiesSection } from "@/components/centre/centre-amenities";
import { CentrePhoto } from "@/components/centre/centre-photo";
import { ExtraConditions } from "@/components/centre/extra-conditions";
import { CompareButton } from "@/components/compare/compare-button";
import { ShortlistDrawer } from "@/components/compare/shortlist-drawer";
import { sectionHeadingClass } from "@/components/centre/section-icon";
import { actionLinkClass } from "@/components/ui/classes";
import { JUDGEMENT_LABELS, JudgementIcon } from "@/components/centre/judgement-icon";
import { inspectionFindings } from "@/lib/judgements";
import { Icon, type IconName } from "@/components/ui/icons";
import {
  centrePhone,
  formatDate,
  formatWeeklyPrice,
  HOME_TYPE_LABELS,
  type CentreDetail,
  type CentreReports,
  type Judgement,
} from "@/lib/centres";
import { centreMetadata, centrePath, centreTabs, getCentreRecord } from "@/lib/centre-record";
import { TabPager } from "@/components/centre/tab-pager";
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
  const { centre, reports, amenities, hiqaCheckedAt } = record;

  return (
    <>
      <Band tint="page">
        <div className="flex flex-col gap-6">
          {/* Empty from an API without them, and for most homes; the box then isn't there. */}
          <ExtraConditions
            conditions={centre.extra_conditions ?? []}
            note={centre.chief_inspector_note ?? null}
            registerDate={centre.register_snapshot.fetched_at}
          />
          {/* Recent changes was here; taken off the overview (CCARE-258). The same changes are on the
              timeline in Inspection history. */}
          <CentreFacts centre={centre} reports={reports} hiqaCheckedAt={hiqaCheckedAt} />
        </div>
      </Band>

      {/* On a band of its own, between the facts and the pointer to What to ask (CCARE-212). */}
      <Band tint="stone">
        <CentreAmenitiesSection
          amenities={amenities}
          reportUrl={reports?.inspections.find((inspection) => inspection.id === String(amenities?.report_id))?.reportUrl}
          fromLatest={reports?.inspections.at(-1)?.id === String(amenities?.report_id)}
        />
        {/* The next page, where the Overview's facts end (CCARE-258), rather than at the foot of the
            page after the pointer to What to ask. */}
        <div className="mt-6">
          <TabPager tabs={centreTabs(centre.centre_id)} inline />
        </div>
      </Band>

      {/* What to ask has a tab of its own (CCARE-212); the overview points to it, as the step to take
          once the facts are read. */}
      <Band tint="page" className="print:hidden">
        <section
          aria-labelledby="visit-h"
          className="flex flex-col gap-4 rounded-2xl bg-tint-blue p-5 text-on-tint-blue sm:flex-row sm:items-center sm:justify-between md:p-7 adult:rounded-lg adult:border adult:border-line"
        >
          <div className="flex items-start gap-3">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-ink">
              <Icon name="talk" className="size-4" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 id="visit-h" className="font-heading text-xl font-semibold">
                Planning a visit?
              </h2>
              <p>We&apos;ve put together what to ask this home, from what its inspections found.</p>
            </div>
          </div>
          {/* The site's main button, filled, lifting and with its arrow moving on hover, like the
              others; it was a plain white pill (CCARE-258). */}
          <Link
            href={centrePath(centre.centre_id, "questions")}
            className={`${actionLinkClass} shrink-0 self-start sm:self-center`}
          >
            See what to ask <span aria-hidden>→</span>
          </Link>
        </section>
      </Band>
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
          {/* What the spreadsheet holds: the home's details, then its inspection history
              (record.csv). "This record" said neither (CCARE-258). */}
          Download home details and inspection results
        </a>
      )}
      <a href={centre.hiqa_url} className={outlineButtonClass}>
        View on the HIQA website
      </a>
      {/* The homes saved so far, so the family can see where this one fits and go on to compare
          them: a button that opens them in a panel from the side, as on the search page, rather than
          a box that made the column taller than the details beside it (CCARE-212). */}
      <div className="mt-1">
        <ShortlistDrawer />
      </div>
    </div>
  );
}

// The facts in small cards by what a family asks about them, rather than one long box of rows
// (CCARE-212): how to reach the home beside the photo, then its size, its cost and its inspections.
function CentreFacts({ centre, reports, hiqaCheckedAt }: { centre: CentreDetail; reports: CentreReports | null; hiqaCheckedAt: string | null }) {
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
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h2 id="facts-h" className={sectionHeadingClass}>
          About this home
        </h2>
        <RecordPrintButton />
      </div>

      {/* The home's facts as a summary list on the left, three fifths of the row, and the photo with the
          actions under it on the right (CCARE-258). A list of rows, each a label beside its value with a
          line between them, rather than cards: the facts are a few short values, and cards (three in a
          row, then one card in two halves) left most of their space empty. A plain list is what the
          GOV.UK Design System advises for "a small amount of related information"; cards are for
          several lists of the same kind of thing. On phones each label sits over its value.

          The photo keeps its own 4:3 shape and is two fifths of the row: larger, or stretched to the
          height of the facts, a home with no photo was mostly an empty frame, which read as the most
          important thing on the page. Placed by grid lines, so the order in the page is the order on
          a phone: the facts, the actions, then the photo, last for the same reason. When the facts are
          the taller side, the extra height goes to the actions' row (auto, then 1fr), so no gap opens
          under the photo. The key is read here, on the server, and only reaches the browser because the
          Places UI Kit has to have it (CCARE-209). */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-[auto_1fr] lg:gap-x-10">
        {/* The facts, then where they come from, together in the left column, so the small print sits
            right under the list rather than under the taller sidebar beside it (CCARE-258). */}
        <div className="flex flex-col gap-4 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start">
          <dl className="divide-y divide-line-soft border-y border-line-soft">
            {/* As it is on the register: some addresses don't start with the name or end with the Eircode. */}
            <SummaryRow label="Address" icon="address">
              {centre.address}
            </SummaryRow>
            {eircode && !addressHasEircode && (
              <SummaryRow label="Eircode" icon="eircode">
                <span className="font-mono">{eircode}</span>
              </SummaryRow>
            )}
            <SummaryRow label="County" icon="county">
              Co. {centre.county}
            </SummaryRow>
            {/* Only a single number gets a tap-to-call link. */}
            {phone && (
              <SummaryRow label="Phone" icon="phone">
                {phoneLink}
              </SummaryRow>
            )}
            {/* "Maximum occupancy" (CCARE-258): "Registered for up to" said less plainly that this is the
                most residents the home may have, not free beds. Where to ask about those is said here,
                where the question comes up, rather than on the search page (CCARE-179). No number here:
                it is in Phone, just above. */}
            <SummaryRow label="Maximum occupancy" icon="beds">
              {centre.maximum_occupancy !== null ? `${centre.maximum_occupancy} residents` : "Not stated"}
              <Note>Contact the home to ask for bed availability.</Note>
            </SummaryRow>
            {/* From the HSE price list the price came from. No row when there's no list for the home. */}
            {centre.home_type && (
              <SummaryRow label="Type of home" icon="home">
                {HOME_TYPE_LABELS[centre.home_type]}
              </SummaryRow>
            )}
            {/* No row from an API without prices (undefined); "Not available" when it has none for this
                home. The price alone (CCARE-258): the price list's date, extra charges and Fair Deal were
                taken out to keep it short. "(Fair Deal)": the price is the one the HSE agreed with the home
                for Fair Deal, from its price list. */}
            {centre.contract_price !== undefined && (
              <SummaryRow
                label={
                  <>
                    Full weekly cost <span className="whitespace-nowrap">(Fair Deal)</span>
                  </>
                }
                icon="cost"
              >
                {centre.contract_price !== null ? (
                  `${formatWeeklyPrice(centre.contract_price)} per week`
                ) : (
                  <>
                    Not available
                    <Note>Ask the home</Note>
                  </>
                )}
              </SummaryRow>
            )}
            {latest && first && (
              <SummaryRow label="Latest inspection" icon="report">
                {formatDate(latest.date)}
                {/* What it found, as the timeline counts it (CCARE-258): in user testing (P2_1) the
                    participant struggled to find what the latest inspection found. */}
                <LatestResult inspectionId={latest.id} reports={reports} />
                <Note>
                  {latest.publishedDate && `Published ${formatDate(latest.publishedDate)} · `}
                  {reports.inspections.length} {reports.inspections.length === 1 ? "report" : "reports"} since{" "}
                  {new Date(first.date).getUTCFullYear()}
                </Note>
                {/* How current the reports are (CCARE-212, from the PR review): when ClearCare last looked
                    on hiqa.ie for a new one. */}
                {hiqaCheckedAt && (
                  <Note>
                    Reports last checked on HIQA:{" "}
                    <span className="whitespace-nowrap">{formatDate(hiqaCheckedAt)}</span>
                  </Note>
                )}
                {/* A button rather than a link in the text, filled like the site's other main buttons
                    (CCARE-258). */}
                <Link href={centrePath(centre.centre_id, "inspections")} className={`${actionLinkClass} mt-2 print:hidden`}>
                  See the inspection history <span aria-hidden>→</span>
                </Link>
              </SummaryRow>
            )}
          </dl>
          <div className="flex flex-col gap-1 text-small leading-relaxed text-ink-muted">
            {/* The HIQA centre ID, here in the small print rather than among the facts (CCARE-258): few
                families look for it, but it is what HIQA knows the home by, so it stays findable, and it
                is in the spreadsheet. */}
            <p>
              HIQA centre ID: <span className="font-mono">{centre.centre_id}</span>
            </p>
            <p>
              Source:{" "}
              <a href={centre.register_snapshot.url} className="text-ink-muted">
                HIQA register
              </a>
              , downloaded {formatDate(centre.register_snapshot.fetched_at)}.
            </p>
            <p>
              Uses HIQA inspection reports and register data under the Irish PSI licence (CC BY 4.0). ClearCare
              does not rate or recommend homes.
            </p>
          </div>
        </div>
        <CentrePhoto
          placeId={centre.place_id ?? null}
          apiKey={process.env.GOOGLE_MAPS_BROWSER_KEY || null}
          className="max-lg:order-last lg:col-start-2 lg:row-start-1 lg:self-start print:hidden"
        />
        <div className="print:hidden lg:col-start-2 lg:row-start-2 lg:self-start">
          <CentreActions centre={centre} reports={reports} />
        </div>
      </div>

    </section>
  );
}

// One row of the summary list: its label, with an icon in the record's sage, beside its value from
// tablet width, over it on phones. The label column is wide enough for the longest label, "Full weekly
// cost (Fair Deal)", on one line. The icon helps the eye find a row; the label says it in words.
function SummaryRow({ label, icon, children }: { label: ReactNode; icon: IconName; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3.5 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:gap-6">
      <dt className="flex items-start gap-2.5 font-medium text-ink-muted">
        <Icon name={icon} className="mt-0.5 size-5 shrink-0 text-on-tint-sage adult:text-ink" />
        {/* In a span of its own, so a label that wraps keeps its lines beside the icon. */}
        <span>{label}</span>
      </dt>
      <dd className="flex min-w-0 flex-col items-start text-ink">{children}</dd>
    </div>
  );
}

// How many regulations the latest inspection judged each way, worst first, with the judgment's mark:
// "4 not compliant · 3 substantially compliant · 6 compliant", or "All 15 compliant". Nothing for an
// inspection with no regulations judged, such as a thematic one.
function LatestResult({ inspectionId, reports }: { inspectionId: string; reports: CentreReports }) {
  const found = inspectionFindings(inspectionId, reports.history, reports.inspections, reports.trails);
  if (!found) return null;
  const countOf = (judgement: Judgement) => found.findings.filter((finding) => finding.judgement === judgement).length;
  const counts = (
    [
      ["not-compliant", countOf("not-compliant")],
      ["substantially-compliant", countOf("substantially-compliant")],
      ["compliant", found.compliant],
    ] satisfies [Judgement, number][]
  ).filter(([, count]) => count > 0);
  const allCompliant = counts.length === 1 && counts[0][0] === "compliant";
  return (
    <ul className="mt-1 mb-0.5 flex flex-wrap gap-x-4 gap-y-1">
      {counts.map(([judgement, count]) => (
        <li key={judgement} className="flex items-center gap-1.5">
          <JudgementIcon judgement={judgement} size={12} />
          {allCompliant && count > 1 ? `All ${count} compliant` : `${count} ${JUDGEMENT_LABELS[judgement].toLowerCase()}`}
        </li>
      ))}
    </ul>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <span className="block text-small text-ink-muted">{children}</span>;
}
