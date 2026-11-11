// app/centres/[id]/page.tsx
import { CentreAmenitiesSection } from "@/components/centre/centre-amenities";
import { CentreContentsBar, contentsScrollMargin, type ContentsItem } from "@/components/centre/centre-contents";
import { CentreHighlights } from "@/components/centre/centre-highlights";
import { SectionAccordion } from "@/components/guides/section-accordion";
import { CompareButton } from "@/components/compare/compare-button";
import { ShortlistBox } from "@/components/compare/shortlist-box";
import { InspectionHistory } from "@/components/centre/inspection-history";
import { PromiseTrail } from "@/components/centre/promise-trail";
import { sectionCardClass, sectionHeadingClass } from "@/components/centre/section-icon";
import { GuidesBand } from "@/components/guides/guide-ending";
import { Alert } from "@/components/layout/alert";
import { Breadcrumb, SEARCH_CRUMB } from "@/components/layout/breadcrumb";
import { ContactsBanner } from "@/components/layout/contacts-banner";
import { fullWidthClass } from "@/components/ui/classes";
import { Icon, type IconName } from "@/components/ui/icons";
import {
  centrePhone,
  formatDate,
  formatWeeklyPrice,
  getCentre,
  getCentreAmenities,
  getCentreFindings,
  getCentreReports,
  HOME_TYPE_LABELS,
  trailAnchor,
  type CentreAmenities,
  type CentreDetail,
  type CentreReports,
} from "@/lib/centres";
import { SHORTLIST_FULL_ID } from "@/lib/compare";
import { addFindings } from "@/lib/findings";
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
  const [baseReports, amenities, findings] = await Promise.all([
    getCentreReports(id),
    getCentreAmenities(id),
    getCentreFindings(id),
  ]);
  // The highlights and promise trails come from the findings (CCARE-207); without them the page
  // shows the history alone, as before.
  const reports = baseReports && addFindings(baseReports, findings);

  // The sections the page has, for its contents, in the order they appear.
  const contents: ContentsItem[] = [
    { id: "about", title: "About this home" },
    ...(reports?.highlights.length ? [{ id: "first", title: "What to look at first" }] : []),
    ...(reports?.visitQuestions.length ? [{ id: "visit", title: "Worth asking on a visit" }] : []),
    reports ? { id: "history", title: "Inspection history" } : { id: "reports", title: "Inspection reports" },
    ...(reports?.trails.length
      ? [
          {
            id: "trails",
            title: "What happened next",
            children: reports.trails.map((trail) => ({
              id: trailAnchor(trail.regulation),
              title: `Regulation ${trail.regulation.number} · ${trail.regulation.title}`,
            })),
          },
        ]
      : []),
    { id: HELP_ID, title: "Making sense of this record" },
  ];

  return (
    <>
      <CentreHero centre={centre} />

      {/* The section links, near the top of the window as the page scrolls. It overlaps the bottom of
          the name's band by 1.25rem, within the band's own padding (1.5rem, 2rem from md), so it
          reads as placed on purpose. A direct child of the page's column, since sticky only holds
          within its parent. */}
      <CentreContentsBar items={contents} className="-mt-[2.75rem] md:-mt-[3.25rem]" />

      {/* Each section on its own band of colour, edge to edge, touching the next. */}
      <div className="-mt-6 flex flex-col md:-mt-8">
        <Band tint="page">
          <CentreFacts centre={centre} reports={reports} amenities={amenities} />
        </Band>

        {reports ? (
          <>
            {reports.highlights.length > 0 && (
              <Band tint="gold">
                <CentreHighlights highlights={reports.highlights} trails={reports.trails} />
              </Band>
            )}

            {reports.visitQuestions.length > 0 && (
              <Band tint="page">
                {/* On the warm band colour, as the part of the record that turns what HIQA found into
                    what the family can do next (CCARE-179). */}
                <section
                  id="visit"
                  aria-labelledby="visit-h"
                  className={`grid ${contentsScrollMargin} gap-3 rounded-2xl bg-warm p-5 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-7 md:p-7 adult:rounded-lg adult:border adult:border-line`}
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

            <Band tint="stone">
              <InspectionHistory
                inspections={reports.inspections}
                history={reports.history}
                trails={reports.trails}
                showAll={regulations === "all"}
                showAllInspections={inspections === "all"}
              />
            </Band>

            {reports.trails.length > 0 && (
              <Band tint="sage">
                {/* One trail per highlighted regulation, closed to begin with so the page stays short.
                    Any number can be open, so a family can read two together and compare them; the
                    highlights, the history table and the bar open them. */}
                <section id="trails" aria-labelledby="trails-h" className={`flex ${contentsScrollMargin} flex-col gap-3`}>
                  <div className="flex flex-col gap-1">
                    <h2 id="trails-h" className={sectionHeadingClass}>
                      What happened next
                    </h2>
                    <p className="max-w-3xl text-ink">
                      For each regulation above: what the inspector found, what the provider said they would do, and when
                      the regulation was next judged.
                    </p>
                  </div>
                  <SectionAccordion />
                  {reports.trails.map((trail) => (
                    <PromiseTrail key={trail.regulation.number} trail={trail} inspections={reports.inspections} />
                  ))}
                </section>
              </Band>
            )}
          </>
        ) : (
          <Band tint="page">
            {/* The heading on the band and the message in a card, as the other sections have. */}
            <section id="reports" aria-labelledby="reports-h" className={`${contentsScrollMargin} flex flex-col gap-3`}>
              <h2 id="reports-h" className={sectionHeadingClass}>
                Inspection reports
              </h2>
              <p className={`${sectionCardClass} p-6 text-ink-muted`}>
                We haven&apos;t added this home&apos;s reports yet. Read them on <a href={centre.hiqa_url}>hiqa.ie</a>.
              </p>
            </section>
          </Band>
        )}
      </div>

      {/* So nobody leaves a record unsure what it means or what to do next. */}
      {/* The negative top margin cancels the page's gap, so it meets the last section's band with no
          strip of page colour between; the bottom one is the band's own default. */}
      <GuidesBand
        id={HELP_ID}
        title="Making sense of this record"
        intro="Inspection reports use a lot of HIQA’s own language. Our guides explain it, and what to ask next."
        guides={RECORD_GUIDES}
        className="-mt-6 -mb-6 md:-mt-8 md:-mb-8"
      />

      {/* The negative bottom margin cancels the page's padding, so it meets the footer. */}
      <ContactsBanner className="-mb-6 md:-mb-10" />
    </>
  );
}


// The tint behind each section, a different one for each so the record reads as stretches of one
// page. Written out in full so Tailwind finds them; the adult-centred design turns the tints to its
// band colour (globals.css).
const BAND_TINTS = {
  page: "",
  gold: "bg-tint-gold",
  stone: "bg-band",
  sage: "bg-tint-sage",
} as const;

// A section on its own full-width band of colour, with the page's column inside it.
function Band({ tint, children }: { tint: keyof typeof BAND_TINTS; children: ReactNode }) {
  return (
    <div className={`${fullWidthClass} ${BAND_TINTS[tint]} py-8 md:py-10`}>
      <div className="page-column px-4 md:px-8">{children}</div>
    </div>
  );
}

// The heading of the guides band at the end, which the contents link to.
const HELP_ID = "help-h";

// The guides that help most with a record, in the order a family needs them.
const RECORD_GUIDES = [getGuide("reading-inspection-reports"), getGuide("choosing-a-nursing-home"), getGuide("fair-deal")];

// The top of the page, flush under the header as on the resources page: the breadcrumb and the
// home's name on the soft welcome band (welcome-band, globals.css).
function CentreHero({ centre }: { centre: CentreDetail }) {
  return (
    <section aria-labelledby="centre-h" className={`${fullWidthClass} welcome-band -mt-6 md:-mt-10`}>
      <div className="page-column px-4 py-6 md:px-8 md:py-8">
        <div className="flex min-w-0 flex-col gap-2.5">
          {/* Where the home sits in the site, the same however the user got here. */}
          <Breadcrumb
            trail={[
              SEARCH_CRUMB,
              { label: `Co. ${centre.county}`, href: `/search?${new URLSearchParams({ county: centre.county })}` },
            ]}
            current={centre.centre_name}
          />
          <h1 id="centre-h" className="font-heading text-[2rem] leading-tight font-semibold tracking-tight text-ink md:text-[2.5rem]">
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
    <div className="flex flex-col gap-2.5 lg:w-80 lg:shrink-0">
      {/* TODO: An "Ask about this home" button, linking to the assistant once that page exists.
          Taken out until then (CCARE-164). */}
      {/* Once the list is full, the shortlist below says so once. */}
      <CompareButton
        home={{ id: centre.centre_id, name: centre.centre_name }}
        fullNoteId={SHORTLIST_FULL_ID}
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
          them. As on the search page, phones only show it once a home is saved. */}
      <ShortlistBox currentId={centre.centre_id} className="mt-2" />
    </div>
  );
}

function CentreFacts({
  centre,
  reports,
  amenities,
}: {
  centre: CentreDetail;
  reports: CentreReports | null;
  amenities: CentreAmenities | null;
}) {
  const latest = reports?.inspections.at(-1);
  const first = reports?.inspections[0];
  const eircode = centre.eircode ? formatEircode(centre.eircode) : null;
  // Most register addresses already end with the Eircode, so it only gets its own row when missing
  // or printed with an O for 0 (A98 C2CO), since the row is then the only place it shows right.
  const addressHasEircode = Boolean(centre.eircode && centre.address.replaceAll(" ", "").toUpperCase().includes(centre.eircode));
  const phone = centrePhone(centre.centre_phone);

  return (
    <section id="about" aria-labelledby="facts-h" className={`flex ${contentsScrollMargin} flex-col gap-3`}>
      <h2 id="facts-h" className={sectionHeadingClass}>
        About this home
      </h2>
      {/* The details, with the actions beside them on wide screens and under them on narrow ones. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        {/* One box of label and value rows, like the centre details on hiqa.ie, with what the home
            offers as its last part, so the two read as one record and the actions come after both on
            phones. White on the page background in the standard design; the adult-centred design adds
            a 3:1 edge. */}
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
              </Fact>
            )}
          </dl>
          <CentreAmenitiesSection
            amenities={amenities}
            reportUrl={reports?.inspections.find((inspection) => inspection.id === String(amenities?.report_id))?.reportUrl}
          />
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
