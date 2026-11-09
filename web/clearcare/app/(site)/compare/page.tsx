// app/(site)/compare/page.tsx
// Compare Homes (CCARE-127): up to five saved homes side by side, laid out as in the comparison
// grid wireframe: rows grouped into Cost, The home, What the home offers (amenities v2, CCARE-163),
// Inspections and Results by regulation, then a next step for each home. Each group folds away
// (CCARE-189). A grid from md up; on phones, one card per row. With room for more homes, a strip
// above the grid says how to add them. The homes are saved in this browser (components/compare);
// their IDs come in the address, ?homes=101,34, so the page is drawn on the server like a centre
// page, and CompareSync keeps the address in step with the saved list. Framed for a family deciding
// together (CCARE-179): the steps to a shortlist when it's empty, a soft icon by each group, and
// the guides and contacts that help with the rest of the choice at the end, as on a centre page.
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { JUDGEMENT_LABELS, JudgementIcon } from "@/components/centre/judgement-icon";
import { ClearCompareButton } from "@/components/compare/clear-compare-button";
import { CollapsibleGroup } from "@/components/compare/collapsible-group";
import { CompareButton } from "@/components/compare/compare-button";
import { CompareSync } from "@/components/compare/compare-sync";
import { StickyHomeNames } from "@/components/compare/sticky-home-names";
import { AmenityIcon } from "@/components/centre/amenity-icon";
import { GuidesBand } from "@/components/guides/guide-ending";
import { LastSearchLink } from "@/components/search/last-search";
import { Alert } from "@/components/layout/alert";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ContactsBanner } from "@/components/layout/contacts-banner";
import { ShowHide } from "@/components/ui/chevron";
import { actionLinkClass, fullWidthClass, secondaryLinkClass } from "@/components/ui/classes";
import { IconCircle, type Tint } from "@/components/ui/icon-circle";
import { ICON_PATHS } from "@/components/ui/icons";
import {
  centrePhone,
  formatDate,
  formatMonth,
  formatWeeklyPrice,
  getCentre,
  getCentreAmenities,
  getCentreReports,
  HOME_TYPE_LABELS,
  type CentreAmenities,
  type CentreDetail,
  type CentreReports,
  type Regulation,
} from "@/lib/centres";
import {
  compareCsvHref,
  compareHref,
  compliantWhereverJudged,
  latestJudged,
  MAX_COMPARED,
  notCompliantAtLatest,
  parseHomesParam,
  regulationRows,
  repeatedNotCompliant,
  type LatestResult,
} from "@/lib/compare";
import { AMENITY_ICON_PATHS } from "@/lib/amenity-icons";
import { asEircode } from "@/lib/eircode";
import { getGuide } from "@/lib/guides";
import { formatEircode, unavailableMessage } from "@/lib/search";

export const metadata: Metadata = { title: "Compare Homes" };

interface ComparePageProps {
  // regulations=all opens the regulations where no home fell short.
  searchParams: Promise<{ homes?: string | string[]; regulations?: string }>;
}

// One home's column. A saved home can drop off the register, or the API can be down.
type FoundColumn = {
  id: string;
  status: "found";
  centre: CentreDetail;
  reports: CentreReports | null;
  amenities: CentreAmenities | null;
};
type Column = FoundColumn | { id: string; status: "not-found" | "unavailable" };

// The amenities v2 lists, labelled and ordered as on the centre page.
const AMENITY_LISTS = [
  { key: "care_types", label: "Types of care" },
  { key: "room_types", label: "Rooms" },
  { key: "activities", label: "Activities" },
  { key: "facilities", label: "Facilities" },
] as const;

// An item every home's report mentions, on a green highlight; the key in the group's intro uses it too.
const commonClass = "inline-block rounded-full bg-tint-sage px-2 py-0.5 font-semibold text-on-tint-sage adult:rounded-md";

// The register's name, or a stand-in for a home that didn't load.
function columnName(column: Column) {
  return column.status === "found" ? column.centre.centre_name : `Centre ID ${column.id}`;
}

async function loadColumn(id: string): Promise<Column> {
  const lookup = await getCentre(id);
  if (lookup.status !== "found") return { id, status: lookup.status };
  const [reports, amenities] = await Promise.all([getCentreReports(id), getCentreAmenities(id)]);
  return { id, status: "found", centre: lookup.centre, reports, amenities };
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { homes, regulations } = await searchParams;
  const ids = parseHomesParam(homes);
  const columns = await Promise.all(ids.map(loadColumn));
  // What a shared address saves: the homes that loaded, and the ones that couldn't be loaded just now,
  // so the link isn't lost. A home off the register is left out.
  const shownHomes = columns.flatMap((column) =>
    column.status === "not-found" ? [] : [{ id: column.id, name: columnName(column) }],
  );
  const loadedNames = Object.fromEntries(
    columns.flatMap((column) => (column.status === "found" ? [[column.id, column.centre.centre_name]] : [])),
  );

  return (
    <>
      {/* The download needs a home that loaded; a link to only unavailable ones would be empty. */}
      <CompareHero csvHref={shownHomes.length > 0 && Object.keys(loadedNames).length > 0 ? compareCsvHref(ids) : undefined} />
      <CompareSync shownIds={ids} shownHomes={shownHomes} loadedNames={loadedNames} />
      {columns.length === 0 ? (
        <NothingSaved />
      ) : columns.every((column) => column.status === "unavailable") ? (
        <Alert title="These homes aren't available right now">{unavailableMessage(0)}</Alert>
      ) : (
        <Comparison columns={columns} showAllRegulations={regulations === "all"} />
      )}

      {/* Comparing records is one part of the choice; these help with the rest. */}
      <GuidesBand
        id="deciding-h"
        title="Deciding together"
        intro="Comparing records is one part of the choice. Our guides help your family with the rest."
        guides={DECIDING_GUIDES}
      />

      {/* The negative bottom margin cancels the page's padding, so it meets the footer. */}
      <ContactsBanner className="-mb-6 md:-mb-10" />
    </>
  );
}

// The guides a family needs most while weighing up homes, in the order they need them.
const DECIDING_GUIDES = [getGuide("how-a-family-chooses"), getGuide("choosing-a-nursing-home"), getGuide("fair-deal")];

// The top of the page, flush under the header, as on the contacts and resources pages: the
// breadcrumb, the heading and a line of welcome on the soft welcome band (welcome-band, globals.css),
// with "Clear the list" beside the line once homes are saved.
function CompareHero({ csvHref }: { csvHref?: string }) {
  return (
    <section aria-labelledby="compare-h" className={`${fullWidthClass} welcome-band -mt-6 md:-mt-10`}>
      <div className="page-column flex flex-col items-start gap-3 px-4 py-6 md:px-8 md:py-8">
        <Breadcrumb trail={[]} current="Compare Homes" />
        {/* tabIndex -1: focus comes here when a Remove button, or Clear the list, goes. */}
        <h1 id="compare-h" tabIndex={-1} className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Compare Homes
        </h1>
        <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="max-w-2xl text-ink-muted md:text-lg">
            Search for homes and add up to {MAX_COMPARED} to your shortlist. See them side by side, so your family can
            talk the choice through together.
          </p>
          <div className="flex flex-wrap gap-2">
            {csvHref && (
              // A plain link, so the browser saves the file the route sends rather than opening a page.
              <a href={csvHref} download className={`${heroButtonClass} inline-flex items-center gap-2 no-underline`}>
                <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4">
                  <path d={ICON_PATHS.download} />
                </svg>
                Download as CSV
              </a>
            )}
            <ClearCompareButton focusAfter="compare-h" className={heroButtonClass} />
          </div>
        </div>
      </div>
    </section>
  );
}

const heroButtonClass =
  "min-h-11 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink hover:border-primary hover:text-ink adult:rounded-md adult:px-4";

// Before anything is saved: the three steps to a comparison, each with an icon in its own soft
// colour, then the way to start and the questions to take on a visit.
const STEPS: { title: string; text: ReactNode; icon: string; tint: Tint }[] = [
  { title: "Find a home", text: "Search by name, address or town, county or Eircode.", icon: ICON_PATHS.search, tint: "blue" },
  {
    title: "Add it to your shortlist",
    text: (
      <>
        Choose &ldquo;Add to shortlist&rdquo; on its page or in the search results. You can save up to {MAX_COMPARED}.
      </>
    ),
    icon: ICON_PATHS.home,
    tint: "sage",
  },
  {
    title: "See them side by side",
    text: "Cost, the home and what HIQA found, in one place to talk through together.",
    icon: ICON_PATHS.results,
    tint: "gold",
  },
];

function NothingSaved() {
  return (
    <section aria-labelledby="empty-h" className="flex flex-col gap-6 rounded-2xl bg-band p-6 md:p-8 adult:rounded-lg">
      <h2 id="empty-h" className="font-heading text-xl font-semibold md:text-2xl">
        No homes saved yet
      </h2>
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm adult:rounded-lg adult:shadow-none"
          >
            <div className="flex items-center gap-3">
              <IconCircle path={step.icon} size="large" tint={step.tint} />
              <span className="text-sm font-semibold text-ink-muted">Step {i + 1}</span>
            </div>
            <h3 className="font-heading text-lg font-semibold">{step.title}</h3>
            <p className="text-ink-muted">{step.text}</p>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-3">
        <Link href="/search" className={actionLinkClass}>
          Search for Homes <span aria-hidden>→</span>
        </Link>
        <Link href="/guides/choosing-a-nursing-home" className={secondaryLinkClass}>
          What to ask when you visit
        </Link>
      </div>
    </section>
  );
}

// For a home whose reports in ClearCare are all thematic inspections, which judge no regulations.
const NONE_JUDGED = "No inspection in ClearCare checked regulations";

// A row of the comparison: a value per home, or one thing across them all (span). A numeric row's
// digits are all one width in the grid, so amounts compare cleanly; they stay left-aligned like the
// rest.
type Row = { key: string; label: ReactNode; hint?: ReactNode; cells?: ReactNode[]; span?: ReactNode; numeric?: boolean };
// Each group has an icon in its own soft colour beside its heading, so the eye can find it.
type Group = { title: string; icon: string; tint: Tint; intro?: ReactNode; rows: Row[] };

function Comparison({ columns, showAllRegulations }: { columns: Column[]; showAllRegulations: boolean }) {
  const groups = buildGroups(columns, showAllRegulations);
  const room = MAX_COMPARED - columns.length;

  return (
    <section aria-labelledby="grid-h" className="flex flex-col gap-4">
      <h2 id="grid-h" className="sr-only">
        Your homes side by side
      </h2>

      {/* From lg up: the grid, with a slim panel for more homes on its right, as tall as the grid,
          marking the free places. On tablets (md to lg) the panel is the strip above the grid, as on
          phones: beside it, it took a quarter of the width and squeezed the homes' columns until
          words broke in the middle (CCARE-214). On phones: the cards, with the strip above them. */}
      <div className="hidden flex-col gap-3 md:flex lg:flex-row">
        {room > 0 && (
          <div className="lg:hidden">
            <AddMore room={room} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <ComparisonTable columns={columns} groups={groups} />
        </div>
        {room > 0 && (
          <div className="hidden w-56 shrink-0 lg:flex">
            <AddMore room={room} side />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4 md:hidden">
        <PhoneHomes columns={columns} />
        {room > 0 && <AddMore room={room} />}
        <PhoneComparison columns={columns} groups={groups} />
      </div>

      <div className="flex flex-wrap justify-between gap-x-10 gap-y-2 text-small leading-relaxed text-ink-muted">
        <p className="max-w-3xl">
          Homes are shown in the order you added them. ClearCare does not rate or recommend homes. Uses HIQA inspection
          reports and register data under the Irish PSI licence (CC BY 4.0), and the HSE&apos;s Fair Deal price lists.
        </p>
        {room > 0 && (
          <LastSearchLink className="font-semibold tap-target">Add another home in Search</LastSearchLink>
        )}
      </div>
    </section>
  );
}

function buildGroups(columns: Column[], showAllRegulations: boolean): Group[] {
  // A value for each home that loaded, a dash for one that didn't (its heading says why).
  const each = (cell: (column: FoundColumn) => ReactNode) =>
    columns.map((column) => (column.status === "found" ? cell(column) : <Muted key={column.id}>–</Muted>));
  // A value for each home with reports in ClearCare.
  const eachReported = (cell: (reports: CentreReports) => ReactNode) =>
    each(({ reports }) => (reports ? cell(reports) : <Muted>No reports in ClearCare yet</Muted>));
  // A value for each home with an inspection that judged regulations, so a home with only thematic
  // inspections doesn't read as "None".
  const eachJudged = (cell: (reports: CentreReports) => ReactNode) =>
    eachReported((reports) => (latestJudged(reports) ? cell(reports) : <Muted>{NONE_JUDGED}</Muted>));

  const latestDate = (column: FoundColumn) => column.reports?.inspections.at(-1)?.date ?? null;

  // Every item these homes' reports mention in one list, the most mentioned first, then A to Z.
  // common: the ones every home mentions, when there are 2 or more homes and all of their reports
  // have been read. A home not read yet might have the item too, so nothing is marked then.
  const readHomes = columns.filter((column) => column.status === "found" && column.amenities).length;
  const amenityItems = (key: (typeof AMENITY_LISTS)[number]["key"]) => {
    const counts = new Map<string, number>();
    for (const column of columns) {
      if (column.status !== "found" || !column.amenities) continue;
      for (const { item } of column.amenities[key]) counts.set(item, (counts.get(item) ?? 0) + 1);
    }
    const items = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b));
    const common = new Set(readHomes > 1 && readHomes === columns.length ? items.filter((item) => counts.get(item) === readHomes) : []);
    return { items, common };
  };

  // The lowest weekly cost and the latest inspection, each marked as a fact about these homes.
  const lowestPrice = markBest(
    columns.map((column) =>
      column.status === "found" && typeof column.centre.contract_price === "number" ? column.centre.contract_price : null,
    ),
    (a, b) => a < b,
  );
  const latestInspection = markBest(
    columns.map((column) => (column.status === "found" ? latestDate(column) : null)),
    (a, b) => a > b,
  );
  // "of these 4", or "of the 3" when a home has no price to compare.
  const ofThese = (count: number) => (count === columns.length ? `of these ${count}` : `of the ${count}`);

  const rows = regulationRows(columns.map((column) => (column.status === "found" ? column.reports : null)));
  const shortfalls = rows.filter((row) => !compliantWhereverJudged(row));
  const compliant = rows.filter(compliantWhereverJudged);
  const regulationRow = (row: (typeof rows)[number]): Row => ({
    key: `reg-${row.regulation.number}`,
    label: <RegulationLabel regulation={row.regulation} />,
    cells: row.results.map((result, i) => <ResultCell key={i} result={result} column={columns[i]} />),
  });
  // Opening and closing them keeps the same homes and the place on the page.
  const toggleHref = `${compareHref(columns.map((column) => column.id))}${showAllRegulations ? "" : "&regulations=all"}`;

  return [
    {
      title: "Cost",
      icon: ICON_PATHS.cost,
      tint: "gold",
      rows: [
        {
          key: "cost",
          label: "Full weekly cost",
          hint: "The HSE’s Fair Deal price, without extra charges.",
          numeric: true,
          cells: each(({ id, centre }) =>
            typeof centre.contract_price === "number" ? (
              <>
                <Value main={formatWeeklyPrice(centre.contract_price)} sub="a week" big />
                {lowestPrice.marked[columns.findIndex((column) => column.id === id)] && (
                  <Marker>
                    {lowestPrice.joint ? "Joint lowest" : "Lowest"} weekly cost {ofThese(lowestPrice.count)}
                  </Marker>
                )}
              </>
            ) : (
              <Value main="Not available" sub="Ask the home" muted />
            ),
          ),
        },
        {
          key: "type",
          label: "Type of home",
          cells: each(({ centre }) =>
            centre.home_type ? <Value main={HOME_TYPE_LABELS[centre.home_type]} /> : <Value main="Not stated" muted />,
          ),
        },
      ],
    },
    {
      title: "The home",
      icon: ICON_PATHS.home,
      tint: "sage",
      rows: [
        {
          key: "beds",
          label: "Registered for",
          hint: "HIQA’s limit, not free beds",
          numeric: true,
          cells: each(({ centre }) =>
            centre.maximum_occupancy !== null ? (
              <Value main={`Up to ${centre.maximum_occupancy} residents`} />
            ) : (
              <Value main="Not stated" muted />
            ),
          ),
        },
        { key: "address", label: "Address", cells: each(({ centre }) => <Value main={shortAddress(centre)} />) },
        {
          key: "eircode",
          label: "Eircode",
          cells: each(({ centre }) =>
            centre.eircode ? <Value main={formatEircode(centre.eircode)} mono /> : <Value main="Not stated" muted />,
          ),
        },
        {
          key: "phone",
          label: "Phone",
          cells: each(({ centre }) => {
            const phone = centrePhone(centre.centre_phone);
            if (!phone) return <Value main="Not listed" muted />;
            return phone.tel ? (
              <a href={`tel:${phone.tel}`} className="font-medium tap-target">
                {phone.text}
              </a>
            ) : (
              <Value main={phone.text} />
            );
          }),
        },
        { key: "id", label: "HIQA centre ID", cells: each(({ centre }) => <Value main={centre.centre_id} mono />) },
      ],
    },
    {
      // As on the centre page (CentreAmenitiesSection): what an AI tool read from one report, said
      // before the values; the passages are on each home's full record. The first sentence is the
      // disclosure the AI Act (Art. 50(4)) and the CC BY licence ask for, so it stays.
      title: "What the home offers",
      icon: ICON_PATHS.beds,
      tint: "band",
      intro: (
        <>
          Read by an AI tool from each home&apos;s inspection report. We&apos;re now checking these, and a home may offer
          more than its report mentions, so always call the home to confirm anything that matters to you.
          {/* The key to the green highlight, where the lists below have one. */}
          {AMENITY_LISTS.some(({ key }) => amenityItems(key).common.size > 0) && (
            <>
              {" "}
              <span className={commonClass}>Green</span> is in every home.
            </>
          )}
        </>
      ),
      rows: [
        // Each home's own items as bullet points, in one order across the homes (the most mentioned
        // first). The ones every home has are on a green highlight, so what they share stands apart
        // from where they differ; screen readers hear "in every home".
        ...AMENITY_LISTS.map(({ key, label }): Row => {
          const { items, common } = amenityItems(key);
          return {
            key,
            // Larger and darker than other rows' labels: each heads a long list beside it.
            label: <span className="text-base font-semibold text-ink">{label}</span>,
            cells: each(({ amenities }) => {
              if (!amenities) return <Muted>Not read from its reports yet</Muted>;
              const mentioned = new Set(amenities[key].map(({ item }) => item));
              if (mentioned.size === 0) return <Muted>None found in the report</Muted>;
              return (
                <ul className="list-disc space-y-1 pl-4 text-sm marker:text-ink-muted">
                  {items
                    .filter((item) => mentioned.has(item))
                    .map((item) => {
                      // An item with a picture (CCARE-225) has it in place of the bullet.
                      const pictured = item in AMENITY_ICON_PATHS;
                      return (
                        <li key={item} className={common.has(item) || pictured ? "-ml-4 list-none" : undefined}>
                          {common.has(item) ? (
                            // On a green highlight in place of the bullet.
                            <span className={`${commonClass} inline-flex items-center gap-1.5`}>
                              <AmenityIcon item={item} />
                              {item}
                              <span className="sr-only"> (in every home)</span>
                            </span>
                          ) : pictured ? (
                            // px-2, as the highlight's, so its words line up with a highlighted item's.
                            <span className="inline-flex items-center gap-1.5 px-2">
                              <AmenityIcon item={item} className="size-5 text-ink-muted adult:size-6" />
                              {item}
                            </span>
                          ) : (
                            item
                          )}
                        </li>
                      );
                    })}
                </ul>
              );
            }),
          };
        }),
        {
          key: "amenities-report",
          // The report these were read from, by its date.
          label: "Report date",
          cells: each(({ amenities }) =>
            !amenities ? (
              <Muted>–</Muted>
            ) : amenities.inspection_date ? (
              <Value main={formatDate(amenities.inspection_date)} />
            ) : (
              <Value main="Not stated" muted />
            ),
          ),
        },
      ],
    },
    {
      title: "Inspections",
      icon: ICON_PATHS.report,
      tint: "blue",
      rows: [
        {
          key: "latest",
          label: "Latest inspection report",
          cells: each((column) => {
            if (!column.reports) return <Muted>No reports in ClearCare yet</Muted>;
            const { inspections } = column.reports;
            const latest = inspections.at(-1)!;
            const since = new Date(inspections[0].date).getUTCFullYear();
            return (
              <>
                <Value
                  main={formatDate(latest.date)}
                  sub={`${inspections.length} ${inspections.length === 1 ? "report" : "reports"} since ${since}`}
                />
                {latestInspection.marked[columns.indexOf(column)] && (
                  <Marker>
                    {latestInspection.joint ? "Joint most recently inspected" : "Most recently inspected"}
                  </Marker>
                )}
              </>
            );
          }),
        },
        {
          key: "not-compliant",
          label: "Not compliant at the latest inspection",
          hint: "Regulations HIQA judged not compliant. The home's record says what it promised to do.",
          cells: eachJudged((reports) => <RegulationCount regulations={notCompliantAtLatest(reports)} />),
        },
        {
          key: "repeated",
          // Worded as the centre page's highlights word the same rule.
          label: "Not compliant at 2 inspections in a row",
          hint: "The last 2 inspections that checked the regulation",
          cells: eachJudged((reports) => <RegulationCount regulations={repeatedNotCompliant(reports)} />),
        },
      ],
    },
    {
      title: "Results by regulation",
      icon: ICON_PATHS.results,
      tint: "rose",
      // No key to the icons: every result says its judgment in words beside its icon.
      intro: (
        <>
          HIQA checks only some regulations at each inspection: &ldquo;Not assessed&rdquo; means none of the home&apos;s
          inspections in ClearCare checked it.
        </>
      ),
      rows: [
        ...(rows.length === 0
          ? [
              {
                key: "none",
                label: "No results yet",
                span: (
                  <Muted>
                    {columns.some((column) => column.status === "found" && column.reports)
                      ? "None of these homes' inspections in ClearCare checked regulations."
                      : "None of these homes' reports are in ClearCare yet."}
                  </Muted>
                ),
              },
            ]
          : []),
        ...shortfalls.map(regulationRow),
        // The regulations where no home fell short, folded behind a link as in the centre page's
        // inspection history, and opened as ordinary rows under it.
        ...(compliant.length > 0
          ? [
              {
                key: "no-issues",
                label: "No issues found",
                hint: `${compliant.length} ${compliant.length === 1 ? "regulation" : "regulations"} where no home fell short`,
                span: (
                  <Link href={toggleHref} scroll={false} className={toggleClass}>
                    {showAllRegulations ? "Hide them" : `Show ${compliant.length === 1 ? "it" : `all ${compliant.length}`}`}
                  </Link>
                ),
              },
              ...(showAllRegulations ? compliant.map(regulationRow) : []),
            ]
          : []),
      ],
    },
  ];
}

// The "Show all" toggle: a link styled as a button, as in the centre page's inspection history.
const toggleClass =
  "inline-flex min-h-11 items-center justify-center rounded-md border-2 border-primary bg-surface px-4 py-2 text-sm font-semibold text-ink no-underline hover:bg-surface-muted hover:text-ink";

// No padding above and below: the rows that fold have it inside FoldCell, and the others add it.
const labelCellClass = "px-3 text-left align-top text-sm font-medium text-ink-muted";
// Narrow columns break long words with a hyphen rather than anywhere.
const homeCellClass = "border-l border-line px-3 align-top break-words hyphens-auto";
const labelColClass = "w-32 lg:w-48";

function ComparisonTable({ columns, groups }: { columns: Column[]; groups: Group[] }) {
  const corner = `${columns.length} of ${MAX_COMPARED} homes`;
  // Shared with the bar of names (StickyHomeNames), so its columns line up with these. Always the
  // frame's width: the columns narrow and wrap rather than scroll sideways.
  const tableClass = "w-full table-fixed border-collapse";
  return (
    <StickyHomeNames
      names={columns.map(columnName)}
      corner={corner}
      labelColClass={labelColClass}
      labelCellClass={labelCellClass}
      homeCellClass={homeCellClass}
      tableClass={tableClass}
    >
      <table className={tableClass}>
        <caption className="sr-only">The {columns.length} homes on your list, side by side</caption>
        <colgroup>
          <col className={labelColClass} />
          {columns.map((column) => (
            <col key={column.id} />
          ))}
        </colgroup>
        {/* The site's brand colour, as in the header and footer, with light text on it. */}
        <thead className="brand-band">
          <tr>
            <td className={`${labelCellClass} py-2.5 text-sm font-normal`}>{corner}</td>
            {columns.map((column) => (
              <th key={column.id} scope="col" className={`${homeCellClass} h-px py-2.5 text-left font-normal`}>
                <HomeHeading column={column} />
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <CollapsibleGroup
            key={group.title}
            heading={
              <>
                {/* Left out below lg, where the label column is w-32: the icon and a one-word title
                    such as "Inspections" don't fit side by side there, and the title was cut off. */}
                <IconCircle path={group.icon} tint={group.tint} className="bg-surface! max-lg:hidden" />
                {group.title}
              </>
            }
            intro={group.intro}
            span={columns.length}
            headingCellClass="px-3 py-1.5 text-left align-middle font-heading text-base font-semibold text-ink lg:text-lg"
          >
            {group.rows.map((row) => (
              <tr key={row.key} className="border-t border-line">
                <th scope="row" className={labelCellClass}>
                  <FoldCell>
                    {row.label}
                    {row.hint && <span className="mt-0.5 block text-xs font-normal leading-snug adult:text-sm">{row.hint}</span>}
                  </FoldCell>
                </th>
                {row.span ? (
                  <td colSpan={columns.length} className={homeCellClass}>
                    <FoldCell>{row.span}</FoldCell>
                  </td>
                ) : (
                  row.cells?.map((cell, i) => (
                    <td key={columns[i].id} className={`${homeCellClass} ${row.numeric ? "tabular-nums" : ""}`}>
                      <FoldCell>{cell}</FoldCell>
                    </td>
                  ))
                )}
              </tr>
            ))}
          </CollapsibleGroup>
        ))}
        <tbody>
          <tr className="border-t-2 border-ink">
            <th scope="row" className={`${labelCellClass} py-2.5`}>
              Next step
            </th>
            {columns.map((column) => (
              <td key={column.id} className={`${homeCellClass} py-2.5`}>
                {column.status === "found" && <NextStep centre={column.centre} />}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </StickyHomeNames>
  );
}

// A cell's content in a group that folds: it slides shut with its group (fold-cell, globals.css), as
// a table row can't grow from no height itself. The padding is inside, so nothing is left of it.
function FoldCell({ children }: { children: ReactNode }) {
  return (
    <div className="fold-cell">
      <div className="py-2.5">{children}</div>
    </div>
  );
}

// A home's name and county, or why it didn't load, with its Remove button: atop its column in the
// grid, at the foot of the cell (its th is h-px, which still grows to the row but gives h-full a
// height to fill) so the buttons line up however long the names, and in the list of
// homes on phones, where Remove sits beside the name to keep the list short.
function HomeHeading({ column, inline = false }: { column: Column; inline?: boolean }) {
  const name = columnName(column);
  return (
    <div className={inline ? "flex items-center justify-between gap-3" : "flex h-full flex-col items-start justify-between gap-1"}>
      <div className="flex flex-col items-start gap-1">
        {column.status === "found" ? (
          <>
            <Link href={`/centres/${column.id}`} className="font-heading text-base font-semibold leading-snug text-ink no-underline hover:underline lg:text-xl adult:text-xl adult:underline">
              {name}
            </Link>
            <span className="text-sm text-ink-muted">Co. {column.centre.county}</span>
          </>
        ) : (
          <>
            <span className="font-semibold">
              {column.status === "not-found" ? "No longer on the HIQA register" : "Couldn't load this home"}
            </span>
            <span className="text-sm text-ink-muted">Centre ID {column.id}</span>
          </>
        )}
      </div>
      <CompareButton
        home={{ id: column.id, name }}
        variant="remove"
        focusAfter="compare-h"
        className="min-h-9 px-2.5 text-sm adult:mt-1 adult:min-h-11"
      />
    </div>
  );
}

const nextStepClass =
  "flex min-h-10 items-center justify-center rounded-full px-3 text-center text-sm font-semibold no-underline adult:min-h-11 adult:rounded-md";

function NextStep({ centre }: { centre: CentreDetail }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Link href={`/centres/${centre.centre_id}`} className={`${nextStepClass} bg-primary text-on-primary hover:bg-primary-hover hover:text-on-primary`}>
        View full record
      </Link>
      <a href={centre.hiqa_url} className={`${nextStepClass} border border-line text-ink hover:border-primary hover:text-ink`}>
        View on the HIQA website
      </a>
    </div>
  );
}

// The space for more homes: a slim panel on the grid's right (side), or a strip above the cards on
// phones.
function AddMore({ room, side = false }: { room: number; side?: boolean }) {
  return (
    // A dashed outline marks the free place on the list, in the soft blue; the adult-centred design
    // keeps its 3:1 field colour and plain fill.
    <div
      className={`flex w-full flex-col gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-tint-blue adult:rounded-lg adult:border-field adult:bg-surface-muted ${
        side ? "items-center p-4 pt-8 text-center" : "px-4 py-3"
      }`}
    >
      <div className={side ? "flex flex-col items-center gap-2" : "flex items-center gap-3"}>
        <IconCircle path={ICON_PATHS.home} tint="band" size={side ? "large" : "small"} />
        <div>
          <h3 className="font-heading text-base font-semibold">
            Add {room === 1 ? "1 more home" : `up to ${room} more homes`}
          </h3>
          <p className="text-sm text-ink-muted">
            Find a home in Search, then choose <strong className="text-ink">Add to shortlist</strong> on its card or page.
          </p>
        </div>
      </div>
      {/* Back to the visitor's last search on this visit, with its filters (CCARE-214), or to an
          empty search when there is none. */}
      <div className={side ? "flex w-full flex-col" : "flex"}>
        <LastSearchLink className={`${actionLinkClass} ${side ? "justify-center text-center" : ""}`}>
          Search for other homes
        </LastSearchLink>
      </div>
    </div>
  );
}

// Phones: the saved homes as a list, headed as in the grid, before the cards.
function PhoneHomes({ columns }: { columns: Column[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-ink-muted">
        Your {columns.length === 1 ? "home" : `${columns.length} homes`}
      </h3>
      <ol className="flex flex-col gap-2">
        {columns.map((column) => (
          <li key={column.id} className="rounded-2xl border border-line bg-surface px-4 py-3 shadow-sm adult:rounded-lg adult:shadow-none">
            <HomeHeading column={column} inline />
          </li>
        ))}
      </ol>
    </div>
  );
}

// Phones: a card per row, each home's value under its name, in groups that fold away as the grid's
// do.
function PhoneComparison({ columns, groups }: { columns: Column[]; groups: Group[] }) {
  const names = columns.map(columnName);
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <details key={group.title} open className="group">
          {/* Stays at the top while its cards scroll by, so it's clear which group they're in. */}
          <summary className="sticky top-0 z-10 -mx-4 flex min-h-12 cursor-pointer list-none items-center gap-2.5 border-y border-section-line bg-section px-4 py-1 [&::-webkit-details-marker]:hidden">
            <IconCircle path={group.icon} tint={group.tint} className="bg-surface!" />
            <h3 className="font-heading text-lg font-semibold">{group.title}</h3>
            <ShowHide className="ml-auto" />
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {group.intro && <div className="text-sm text-ink-muted">{group.intro}</div>}
            {group.rows.map((row) => (
              <div key={row.key} className="overflow-hidden rounded-2xl border border-line bg-surface adult:rounded-lg">
                <div className="px-4 pb-1 pt-3">
                  <h4 className="font-semibold">{row.label}</h4>
                  {row.hint && <p className="text-sm leading-snug text-ink-muted">{row.hint}</p>}
                </div>
                {row.span ? (
                  <div className="border-t border-line px-4 py-2.5">{row.span}</div>
                ) : (
                  <dl>
                    {row.cells?.map((cell, i) => (
                      <div key={columns[i].id} className="flex flex-col border-t border-line px-4 py-2.5">
                        <dt className="text-sm text-ink-muted">{names[i]}</dt>
                        <dd>{cell}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            ))}
          </div>
        </details>
      ))}
      <p className="text-sm text-ink-muted">Each home&apos;s full record has its inspection history and reports.</p>
    </div>
  );
}

// The register's address without what the grid already shows: the home's name, which often starts
// it, and the Eircode, which often ends it and has a row of its own. The ending is compared as
// asEircode reads it: the register prints two Eircodes with a letter O for 0 (A98 C2CO), and the
// row shows them with the 0.
function shortAddress({ centre_name, address, eircode }: CentreDetail) {
  let short = address;
  if (short.toLowerCase().startsWith(`${centre_name},`.toLowerCase())) short = short.slice(centre_name.length + 1).trim();
  const lastComma = short.lastIndexOf(",");
  if (eircode && asEircode(short.slice(lastComma + 1)) === eircode) short = short.slice(0, Math.max(lastComma, 0));
  return short;
}

function Value({ main, sub, big = false, mono = false, muted = false }: { main: string; sub?: string; big?: boolean; mono?: boolean; muted?: boolean }) {
  const mainClass = big ? "text-lg font-bold adult:text-xl" : mono ? "font-mono" : muted ? "text-ink-muted" : "font-medium";
  return (
    <>
      <span className={mainClass}>{main}</span>
      {sub && <span className="block text-sm text-ink-muted">{sub}</span>}
    </>
  );
}

// "None", or "2 regulations" with their names under it.
function RegulationCount({ regulations }: { regulations: Regulation[] }) {
  if (regulations.length === 0) return <Value main="None" />;
  return (
    <Value
      main={`${regulations.length} ${regulations.length === 1 ? "regulation" : "regulations"}`}
      sub={regulations.map((regulation) => regulation.title).join(", ")}
    />
  );
}

function RegulationLabel({ regulation }: { regulation: Regulation }) {
  return (
    <span>
      <span className="text-sm font-normal text-ink-muted tabular-nums">Reg. {regulation.number}</span>{" "}
      <span className="text-ink">{regulation.title}</span>
    </span>
  );
}

function ResultCell({ result, column }: { result: LatestResult | null; column: Column }) {
  if (column.status !== "found") return <Muted>–</Muted>;
  if (!column.reports) return <Muted>No reports in ClearCare yet</Muted>;
  if (!result) {
    // Reports list only the regulations HIQA checked, each with a judgment, so a missing one wasn't
    // assessed at any of the home's inspections in ClearCare.
    const inspected = column.reports.inspections.filter((inspection) => inspection.regulationJudgements).length;
    return (
      <span className="flex items-start gap-2">
        <span className="flex h-6 items-center">
          <JudgementIcon judgement="not-assessed" />
        </span>
        <span>
          {JUDGEMENT_LABELS["not-assessed"]}
          <span className="block text-sm text-ink-muted">
            {inspected === 0
              ? NONE_JUDGED
              : inspected === 1
                ? "At its one inspection"
                : `At any of its ${inspected} inspections`}
          </span>
        </span>
      </span>
    );
  }
  return (
    <span className="flex items-start gap-2">
      {/* Lines the icon up with the first line of text. */}
      <span className="flex h-6 items-center">
        <JudgementIcon judgement={result.judgement} />
      </span>
      <span>
        {JUDGEMENT_LABELS[result.judgement]}
        <span className="block text-sm text-ink-muted">{formatMonth(result.date)}</span>
      </span>
    </span>
  );
}

// Which homes have the best value (the lowest price, the latest date), for a marker under each.
// None when fewer than 2 homes have a value or they're all the same, as there's nothing to tell apart.
function markBest<T extends string | number>(values: (T | null)[], better: (a: T, b: T) => boolean) {
  const known = values.filter((value): value is T => value !== null);
  const best = known.reduce<T | null>((a, b) => (a === null || better(b, a) ? b : a), null);
  const marked =
    known.length < 2 || known.every((value) => value === best) ? values.map(() => false) : values.map((value) => value === best);
  return { marked, joint: marked.filter(Boolean).length > 1, count: known.length };
}

// A fact about one home among these, such as the lowest weekly cost: in plain words, in the soft
// gold so it's easy to spot and apart from the green of what every home offers, with no tick that
// would read as advice. ClearCare doesn't rate or recommend homes.
function Marker({ children }: { children: ReactNode }) {
  return (
    <span className="mt-1.5 inline-block rounded-full bg-tint-gold px-2.5 py-0.5 text-sm text-on-tint-gold adult:rounded-md">
      {children}
    </span>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-sm text-ink-muted">{children}</span>;
}
