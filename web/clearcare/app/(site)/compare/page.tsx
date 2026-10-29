// app/(site)/compare/page.tsx
// Compare Homes (CCARE-127): up to three saved homes side by side, laid out as in the comparison
// grid wireframe: rows grouped into Cost, The home, Inspections and Results by regulation, then a
// next step for each home. A grid from md up; on phones, one card per row. With room for more
// homes, a panel says how to add them. The homes are saved in this browser (components/compare);
// their IDs come in the address, ?homes=101,34, so the page is drawn on the server like a centre
// page, and CompareSync keeps the address in step with the saved list.
import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { JUDGEMENT_LABELS, JudgementIcon } from "@/components/centre/judgement-icon";
import { ClearCompareButton } from "@/components/compare/clear-compare-button";
import { CompareButton } from "@/components/compare/compare-button";
import { CompareSync } from "@/components/compare/compare-sync";
import { Alert } from "@/components/layout/alert";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { actionLinkClass, comingSoonClass, fullWidthClass } from "@/components/ui/classes";
import {
  centrePhone,
  formatDate,
  formatMonth,
  formatWeeklyPrice,
  getCentre,
  getCentreReports,
  HOME_TYPE_LABELS,
  type CentreDetail,
  type CentreReports,
  type Regulation,
} from "@/lib/centres";
import {
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
import { formatEircode, unavailableMessage } from "@/lib/search";

export const metadata: Metadata = { title: "Compare Homes" };

interface ComparePageProps {
  // regulations=all opens the regulations where no home fell short.
  searchParams: Promise<{ homes?: string | string[]; regulations?: string }>;
}

// One home's column. A saved home can drop off the register, or the API can be down.
type FoundColumn = { id: string; status: "found"; centre: CentreDetail; reports: CentreReports | null };
type Column = FoundColumn | { id: string; status: "not-found" | "unavailable" };

async function loadColumn(id: string): Promise<Column> {
  const lookup = await getCentre(id);
  if (lookup.status !== "found") return { id, status: lookup.status };
  return { id, status: "found", centre: lookup.centre, reports: await getCentreReports(id) };
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { homes, regulations } = await searchParams;
  const ids = parseHomesParam(homes);
  const columns = await Promise.all(ids.map(loadColumn));
  const shownHomes = columns.flatMap((column) =>
    column.status === "found" ? [{ id: column.id, name: column.centre.centre_name }] : [],
  );

  return (
    <>
      <CompareHero />
      <CompareSync shownIds={ids} shownHomes={shownHomes} />
      {columns.length === 0 ? (
        <NothingSaved />
      ) : columns.every((column) => column.status === "unavailable") ? (
        <Alert title="These homes aren't available right now">{unavailableMessage(0)}</Alert>
      ) : (
        <Comparison columns={columns} showAllRegulations={regulations === "all"} />
      )}
    </>
  );
}

// The top of the page, flush under the header, as on the contacts and resources pages: the
// breadcrumb, the heading and a line of welcome on a band of brand colour (brand-band, globals.css),
// with "Clear the list" beside the line once homes are saved.
function CompareHero() {
  return (
    <section aria-labelledby="compare-h" className={`${fullWidthClass} brand-band -mt-6 md:-mt-10`}>
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-6 md:px-8 md:py-8">
        <Breadcrumb trail={[]} current="Compare Homes" />
        <h1 id="compare-h" className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Compare Homes
        </h1>
        <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="max-w-2xl text-ink-muted md:text-lg">
            Search for homes and add up to {MAX_COMPARED} to your shortlist.
          </p>
          <ClearCompareButton className="min-h-11 rounded-md border border-line bg-surface px-4 text-sm font-semibold text-ink hover:border-primary" />
        </div>
      </div>
    </section>
  );
}

function NothingSaved() {
  return (
    <section aria-labelledby="empty-h" className="flex flex-col items-start gap-3 rounded-lg bg-band p-6 md:p-8">
      <h2 id="empty-h" className="font-heading text-xl font-semibold md:text-2xl">
        No homes saved yet
      </h2>
      <p className="max-w-2xl">
        Find a home, then choose &ldquo;Add to shortlist&rdquo; on its page or in the search results. You can save up to{" "}
        {MAX_COMPARED}.
      </p>
      <Link href="/search" className={actionLinkClass}>
        Search for Homes
      </Link>
    </section>
  );
}

// For a home whose reports in ClearCare are all thematic inspections, which judge no regulations.
const NONE_JUDGED = "No inspection in ClearCare checked regulations";

// A row of the comparison: a value per home, or one thing across them all (span).
type Row = { key: string; label: ReactNode; hint?: ReactNode; cells?: ReactNode[]; span?: ReactNode };
type Group = { title: string; intro?: ReactNode; rows: Row[] };

function Comparison({ columns, showAllRegulations }: { columns: Column[]; showAllRegulations: boolean }) {
  const groups = buildGroups(columns, showAllRegulations);
  const room = MAX_COMPARED - columns.length;
  // The first home's county, for "Search in Co. …".
  const county = columns.find((column): column is FoundColumn => column.status === "found")?.centre.county;

  return (
    <section aria-labelledby="grid-h" className="flex flex-col gap-4">
      <h2 id="grid-h" className="sr-only">
        Your homes side by side
      </h2>

      {/* From md up: the grid, with the panel for more homes beside it, sharing the width as the
          columns would. On phones: the cards, with the panel above them. */}
      <div className="hidden gap-4 md:flex">
        <div className="min-w-0" style={{ flex: `${columns.length + 0.7} 1 0%` } as CSSProperties}>
          <ComparisonTable columns={columns} groups={groups} />
        </div>
        {room > 0 && (
          <div className="flex" style={{ flex: `${room} 1 0%` } as CSSProperties}>
            <AddMore room={room} county={county} />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4 md:hidden">
        <PhoneHomes columns={columns} />
        {room > 0 && <AddMore room={room} county={county} />}
        <PhoneComparison columns={columns} groups={groups} />
      </div>

      <div className="flex flex-wrap justify-between gap-x-10 gap-y-2 text-small leading-relaxed text-ink-muted">
        <p className="max-w-3xl">
          Homes are shown in the order you added them. ClearCare does not rate or recommend homes. Uses HIQA inspection
          reports and register data under the Irish PSI licence (CC BY 4.0), and the HSE&apos;s Fair Deal price lists.
        </p>
        {room > 0 && (
          <Link href="/search" className="font-semibold tap-target">
            Add another home in Search
          </Link>
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
      rows: [
        {
          key: "cost",
          label: "Full weekly cost",
          hint: "The HSE’s Fair Deal price, without extra charges.",
          cells: each(({ centre }) =>
            typeof centre.contract_price === "number" ? (
              <Value main={formatWeeklyPrice(centre.contract_price)} sub="a week" big />
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
      rows: [
        {
          key: "beds",
          label: "Registered for",
          hint: "HIQA’s limit, not free beds",
          cells: each(({ centre }) =>
            centre.maximum_occupancy !== null ? (
              <Value main={`Up to ${centre.maximum_occupancy} residents`} />
            ) : (
              <Value main="Not stated" muted />
            ),
          ),
        },
        {
          // TODO: A row each once the API has them.
          key: "coming-soon",
          label: "Care types and amenities",
          span: <span className={`inline-block px-3 py-1.5 text-sm ${comingSoonClass}`}>Coming soon</span>,
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
      title: "Inspections",
      rows: [
        {
          key: "latest",
          label: "Latest report",
          cells: eachReported(({ inspections }) => {
            const latest = inspections.at(-1)!;
            const since = new Date(inspections[0].date).getUTCFullYear();
            return (
              <Value
                main={`Inspected ${formatDate(latest.date)}`}
                sub={`${inspections.length} ${inspections.length === 1 ? "report" : "reports"} since ${since}`}
              />
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
          label: "Repeated issues",
          hint: "Not compliant at the last 2 inspections that checked it",
          cells: eachJudged((reports) => <RegulationCount regulations={repeatedNotCompliant(reports)} />),
        },
      ],
    },
    {
      title: "Results by regulation",
      intro: (
        <span className="flex flex-col gap-1.5">
          Each home&apos;s latest judgment, and when. Where a home fell short comes first. Homes are inspected at different
          times, so check the dates. HIQA checks only some regulations at each inspection: &ldquo;Not assessed&rdquo;
          means none of the home&apos;s inspections in ClearCare checked it.
          <span aria-label="Key" className="flex flex-wrap gap-x-4 gap-y-1">
            {(["compliant", "substantially-compliant", "not-compliant", "not-assessed"] as const).map((judgement) => (
              <span key={judgement} className="flex items-center gap-1.5">
                <JudgementIcon judgement={judgement} size={12} />
                {JUDGEMENT_LABELS[judgement]}
              </span>
            ))}
          </span>
        </span>
      ),
      rows: [
        ...(rows.length === 0
          ? [{ key: "none", label: "No results yet", span: <Muted>None of these homes&apos; reports are in ClearCare yet.</Muted> }]
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

// The label column stays in place if the grid has to scroll sideways, as in the centre page's
// inspection history.
const labelCellClass = "sticky left-0 z-10 bg-surface p-4 text-left align-top font-medium text-ink-muted";
const homeCellClass = "border-l border-line-soft p-4 align-top";

function ComparisonTable({ columns, groups }: { columns: Column[]; groups: Group[] }) {
  return (
    <div className="h-full overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[30rem] table-fixed border-collapse">
        <caption className="sr-only">The {columns.length} homes on your list, side by side</caption>
        <colgroup>
          <col className="w-44 lg:w-52" />
          {columns.map((column) => (
            <col key={column.id} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b-2 border-ink">
            <td className={`${labelCellClass} text-sm font-normal`}>
              {columns.length} of {MAX_COMPARED} homes
            </td>
            {columns.map((column) => (
              <th key={column.id} scope="col" className={`${homeCellClass} text-left font-normal`}>
                <HomeHeading column={column} />
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.title}>
            <tr className="border-t border-line bg-surface-muted">
              <th scope="colgroup" className={`${labelCellClass} bg-surface-muted pb-2 font-heading text-lg font-semibold text-ink`}>
                {group.title}
              </th>
              <td colSpan={columns.length} className="px-4 pb-2 pt-4 align-top text-sm text-ink-muted">
                {group.intro}
              </td>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.key} className="border-t border-line-soft">
                <th scope="row" className={labelCellClass}>
                  {row.label}
                  {row.hint && <span className="mt-0.5 block text-sm font-normal leading-snug">{row.hint}</span>}
                </th>
                {row.span ? (
                  <td colSpan={columns.length} className={homeCellClass}>
                    {row.span}
                  </td>
                ) : (
                  row.cells?.map((cell, i) => (
                    <td key={columns[i].id} className={homeCellClass}>
                      {cell}
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        ))}
        <tbody>
          <tr className="border-t-2 border-ink">
            <th scope="row" className={labelCellClass}>
              Next step
            </th>
            {columns.map((column) => (
              <td key={column.id} className={homeCellClass}>
                {column.status === "found" && <NextStep centre={column.centre} />}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function HomeHeading({ column }: { column: Column }) {
  const name = column.status === "found" ? column.centre.centre_name : `centre ${column.id}`;
  return (
    <div className="flex flex-col items-start gap-1.5">
      {column.status === "found" ? (
        <>
          <Link href={`/centres/${column.id}`} className="font-heading text-xl font-semibold leading-snug text-ink">
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
      <CompareButton home={{ id: column.id, name }} variant="remove" className="mt-1 min-h-11 px-3 text-sm" />
    </div>
  );
}

const nextStepClass = "flex min-h-11 items-center justify-center rounded-md px-3 text-center text-sm font-semibold no-underline";

function NextStep({ centre }: { centre: CentreDetail }) {
  return (
    <div className="flex flex-col gap-2">
      <Link href={`/centres/${centre.centre_id}`} className={`${nextStepClass} bg-primary text-on-primary hover:bg-primary-hover hover:text-on-primary`}>
        View full record
      </Link>
      <a href={centre.hiqa_url} className={`${nextStepClass} border border-line text-ink hover:border-primary hover:text-ink`}>
        View on the HIQA website
      </a>
    </div>
  );
}

// The space for more homes: beside the grid, or above the cards on phones.
function AddMore({ room, county }: { room: number; county?: string }) {
  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-lg border-2 border-dashed border-field bg-surface-muted p-6 text-center md:justify-start md:pt-16">
      <h3 className="font-heading text-xl font-semibold md:text-2xl">
        Add {room === 1 ? "1 more home" : "1 or 2 more homes"}
      </h3>
      <p className="max-w-sm text-ink-muted">
        Find a home in Search, then choose <strong className="text-ink">Add to shortlist</strong> on its card or page. It
        will appear here.
      </p>
      <div className="flex flex-wrap justify-center gap-2.5">
        {county && (
          <Link href={`/search?${new URLSearchParams({ county })}`} className={actionLinkClass}>
            Search in Co. {county}
          </Link>
        )}
        <Link
          href="/search"
          className="inline-flex h-12 items-center rounded-md border border-line bg-surface px-5 font-semibold text-ink no-underline hover:border-primary hover:text-ink"
        >
          Search all homes
        </Link>
      </div>
    </div>
  );
}

// Phones: the saved homes as a list, each with its ✕, before the cards.
function PhoneHomes({ columns }: { columns: Column[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-ink-muted">
        Your {columns.length === 1 ? "home" : `${columns.length} homes`}
      </h3>
      <ol className="flex flex-col gap-2">
        {columns.map((column) => {
          const name = column.status === "found" ? column.centre.centre_name : `Centre ID ${column.id}`;
          return (
            <li key={column.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface py-1.5 pl-4 pr-1.5">
              {column.status === "found" ? (
                <Link href={`/centres/${column.id}`} className="font-semibold leading-snug text-ink">
                  {name}
                </Link>
              ) : (
                <span className="font-semibold">{name}</span>
              )}
              <CompareButton home={{ id: column.id, name }} variant="remove" iconOnly className="size-11 shrink-0" />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Phones: a card per row, each home's value under its name.
function PhoneComparison({ columns, groups }: { columns: Column[]; groups: Group[] }) {
  const names = columns.map((column) => (column.status === "found" ? column.centre.centre_name : `Centre ID ${column.id}`));
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title} className="flex flex-col gap-2">
          <h3 className="font-heading text-xl font-semibold">{group.title}</h3>
          {group.intro && <div className="text-sm text-ink-muted">{group.intro}</div>}
          {group.rows.map((row) => (
            <div key={row.key} className="overflow-hidden rounded-lg border border-line bg-surface">
              <div className="px-4 pb-1 pt-3">
                <h4 className="font-semibold">{row.label}</h4>
                {row.hint && <p className="text-sm leading-snug text-ink-muted">{row.hint}</p>}
              </div>
              {row.span ? (
                <div className="border-t border-line-soft px-4 py-2.5">{row.span}</div>
              ) : (
                <dl>
                  {row.cells?.map((cell, i) => (
                    <div key={columns[i].id} className="flex flex-col border-t border-line-soft px-4 py-2.5">
                      <dt className="text-sm text-ink-muted">{names[i]}</dt>
                      <dd>{cell}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}
        </section>
      ))}
      <p className="text-sm text-ink-muted">Each home&apos;s full record has its inspection history and reports.</p>
    </div>
  );
}

// The register's address without what the grid already shows: the home's name, which often starts
// it, and the Eircode, which often ends it and has a row of its own.
function shortAddress({ centre_name, address, eircode }: CentreDetail) {
  let short = address;
  if (short.toLowerCase().startsWith(`${centre_name},`.toLowerCase())) short = short.slice(centre_name.length + 1).trim();
  const formatted = eircode ? formatEircode(eircode) : null;
  if (formatted && short.endsWith(formatted)) short = short.slice(0, -formatted.length).replace(/,\s*$/, "");
  return short;
}

function Value({ main, sub, big = false, mono = false, muted = false }: { main: string; sub?: string; big?: boolean; mono?: boolean; muted?: boolean }) {
  const mainClass = big ? "text-xl font-bold" : mono ? "font-mono" : muted ? "text-ink-muted" : "font-medium";
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

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-sm text-ink-muted">{children}</span>;
}
