// components/centre/timeline.tsx
// What has happened at a home, in order (CCARE-235): its inspections, the changes to its entry on
// HIQA's register and the changes of its contract price, one short row each, so a family sees the
// home's story without opening each report. A row says the date, what kind of thing it is and what
// changed, in the fewest words and marks, and does not repeat the report: an inspection's row names
// the regulations judged not compliant, or counts them when they are many, and counts the rest. The
// API sends an event as a kind and its fields (ADR-0033); every word a reader sees for one is
// written here, once, in the function of its kind.
import { ShowHide } from "@/components/ui/chevron";
import { ExternalIcon } from "@/components/ui/external-icon";
import {
  formatDate,
  formatDayOfYear,
  formatWeeklyPrice,
  type Inspection,
  type ISODate,
  type Judgement,
  type PromiseTrail,
  type RegulationHistory,
} from "@/lib/centres";
import {
  foldOlderYears,
  noticeWords,
  priceDifference,
  rowsByYear,
  type BedsEvent,
  type CentreEvent,
  type ConditionAddedEvent,
  type ConditionChangedEvent,
  type ConditionRemovedEvent,
  type InspectionEvent,
  type NameEvent,
  type NoteAddedEvent,
  type PriceEvent,
  type ProviderEvent,
  type RegistrationEvent,
  type ThematicInspectionEvent,
  type TimelineYear,
  type UnreadReportEvent,
} from "@/lib/events";
import { inspectionFindings, namesNotCompliant } from "@/lib/judgements";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";
import { JUDGEMENT_LABELS, JudgementIcon } from "./judgement-icon";
import { ClampedWords, WordsToggle, wordsGroupClass } from "./register-words";
import { ShowInGrid } from "./show-in-grid";

// What a row says: the kind of thing it is, then what changed. words: HIQA's own words for the
// change, a condition's or the note's, apart from ours so that a page that already quotes them can
// leave them out.
// link: the report a row is about, shown beside the row's date (CCARE-258).
type RowWords = { label: string; body: ReactNode; words?: ReactNode; link?: ReactNode };

// What the page has read of the home's reports, as the grid of judgments under the timeline gets it,
// and the page the trails are on. With it an inspection's row names the regulations judged not
// compliant.
export type ReportsRead = {
  inspections: Inspection[];
  history: RegulationHistory[];
  trails: PromiseTrail[];
  trailsHref: string;
};

// No default: a kind added to CentreEvent doesn't compile until it has a row here.
export function rowWords(event: CentreEvent, reports?: ReportsRead): RowWords {
  switch (event.kind) {
    case "inspection":
      return inspectionRow(event, reports);
    case "thematic_inspection":
      return thematicInspectionRow(event);
    case "unread_report":
      return unreadReportRow(event);
    case "registration":
      return registrationRow(event);
    case "provider":
      return providerRow(event);
    case "name":
      return nameRow(event);
    case "beds":
      return bedsRow(event);
    case "condition_added":
      return conditionAddedRow(event);
    case "condition_changed":
      return conditionChangedRow(event);
    case "condition_removed":
      return conditionRemovedRow(event);
    case "note_added":
      return noteAddedRow(event);
    case "note_removed":
      return noteRemovedRow();
    case "price":
      return priceRow(event);
  }
}

const mutedClass = "text-sm text-ink-muted";

// An unannounced inspection says so in its label, "Unannounced inspection" (CCARE-258), rather than
// the timeline saying once that inspections are without notice unless a row says otherwise. Any other
// notice is said beside the findings (noticeWords).
function isUnannounced(inspectionType: string | null) {
  return inspectionType?.trim().toLowerCase() === "unannounced";
}

// What an inspection's row says, on one line where it fits: the regulations judged not compliant by
// title, which is what a family reads the row for, then how many were substantially compliant and
// how many compliant, as a mark and a number. More than three are not named: the row says how many
// there are, "12 not compliant", where the titles would be (MOST_NOT_COMPLIANT_NAMED in
// lib/judgements.ts). Only the titles, or that count, stand out. The titles are in the report, so
// they are there when the page has read it. The API's event has only how many regulations got each
// judgment, so without the report the row counts all three.
function inspectionRow(event: InspectionEvent, reports?: ReportsRead): RowWords {
  const notice = noticeWords(event.inspection_type);
  const found = reports && findingsOf(event, reports);
  const notCompliant = found?.findings.filter((finding) => finding.judgement === "not-compliant") ?? [];
  const named = namesNotCompliant(notCompliant.length) ? notCompliant : [];
  const counts: [Judgement, number][] = found
    ? [
        ["substantially-compliant", found.findings.length - notCompliant.length],
        ["compliant", found.compliant],
      ]
    : [
        ["not-compliant", event.not_compliant],
        ["substantially-compliant", event.substantially_compliant],
        ["compliant", event.compliant],
      ];
  // A judgment nobody got is left out.
  const counted = counts.filter(([, count]) => count > 0);
  // "All 14 compliant", as a lone "● 14" would leave the reader to work out that nothing was found.
  // Not of one regulation: "All 1" is not English.
  const allCompliant = notCompliant.length === 0 && counted.length === 1 && counted[0][0] === "compliant" && counted[0][1] > 1;

  return {
    label: isUnannounced(event.inspection_type) ? "Unannounced inspection" : "Inspection",
    link: <ReportLink event={event} />,
    body: (
      <>
        {/* A screen reader hears "Not compliant: Premises", or "12 not compliant", then
            "4 substantially compliant", "5 compliant". */}
        <ul className={judgedClass}>
          {named.map(({ regulation }) => (
            // The mark and the title side by side, so a long title wraps beside its mark and never
            // leaves it alone on a line.
            <li key={regulation.number} className="flex items-baseline font-medium">
              <Mark judgement="not-compliant" />
              <span className="sr-only">{JUDGEMENT_LABELS["not-compliant"]}: </span>
              {/* Points to its cell in the grid beside the timeline, rather than leading to What happened
                  next (CCARE-258). */}
              <ShowInGrid inspectionId={String(event.report_id)} regulation={regulation.number}>
                {regulation.title}
              </ShowInGrid>
            </li>
          ))}
          {notCompliant.length > named.length && (
            // In the titles' place and as they are: it is the row's main fact. Points to which they are
            // in the grid beside the timeline (CCARE-258); only here, where the page has the grid.
            <li className="whitespace-nowrap font-medium">
              <Mark judgement="not-compliant" />
              <ShowInGrid inspectionId={String(event.report_id)}>
                {notCompliant.length} {JUDGEMENT_LABELS["not-compliant"].toLowerCase()}
              </ShowInGrid>
            </li>
          )}
          {counted.map(([judgement, count]) => (
            <li key={judgement} className="whitespace-nowrap text-ink-muted">
              <Mark judgement={judgement} />
              {allCompliant ? (
                `All ${count} compliant`
              ) : (
                <>
                  {count}
                  <span className="sr-only"> {JUDGEMENT_LABELS[judgement].toLowerCase()}</span>
                </>
              )}
            </li>
          ))}
          {notice && <li className={mutedClass}>{notice}</li>}
        </ul>
      </>
    ),
  };
}

function findingsOf(event: InspectionEvent, reports: ReportsRead) {
  return inspectionFindings(String(event.report_id), reports.history, reports.inspections, reports.trails);
}

// What a report's row says before its link: words that wrap as a line does. gap-y-2: a title's link
// has padding that reaches past its line, and the lines' links mustn't overlap.
const judgedClass = "flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-2";

// A link in a row's line of words. The padding makes it easier to tap; -my-1 and tap-target-top
// keep its words on the line of the row's date and label where the link is 44px tall (globals.css).
const rowLinkClass = "-my-1 py-1 tap-target-top";

// A judgment's mark before its words or its number: it sits on their line.
function Mark({ judgement }: { judgement: Judgement }) {
  return (
    <span className="mr-1.5 inline-block shrink-0">
      <JudgementIcon judgement={judgement} size={12} />
    </span>
  );
}

// Judged against the National Standards, so it has one overall judgment and no marks: those are for
// judgments of regulations. The API doesn't say what the theme was, so the row doesn't either.
function thematicInspectionRow(event: ThematicInspectionEvent): RowWords {
  const notice = noticeWords(event.inspection_type);
  return {
    label: isUnannounced(event.inspection_type) ? "Unannounced thematic inspection" : "Thematic inspection",
    link: <ReportLink event={event} />,
    body: (
      <p className={judgedClass}>
        {event.overall_judgment} overall
        {notice && <span className={mutedClass}>{notice}</span>}
      </p>
    ),
  };
}

// A report HIQA lists that ClearCare holds no reading of: the row says it exists and where it is.
// With no reading there is no type of inspection, so the row says the notice isn't known.
function unreadReportRow(event: UnreadReportEvent): RowWords {
  return {
    label: "Inspection",
    link: <ReportLink event={event} />,
    body: <p className={mutedClass}>{noticeWords(null)}</p>,
  };
}

// Never called a renewal, or late: a new registered provider also gets a new registration, and the
// register can show one months after it started (ADR-0031).
function registrationRow(event: RegistrationEvent): RowWords {
  return {
    label: "Registration",
    body: (
      <p>
        Registered to <time dateTime={event.registered_until}>{formatDate(event.registered_until)}</time>
      </p>
    ),
  };
}

// A provider without a CRO number is not named, so either name can be missing.
function providerRow(event: ProviderEvent): RowWords {
  return {
    label: "Register",
    body: (
      <>
        <p>
          New registered provider
          {event.after && `: ${event.after}`}
        </p>
        {event.before && <p className={mutedClass}>Was {event.before}</p>}
      </>
    ),
  };
}

function nameRow(event: NameEvent): RowWords {
  return { label: "Register", body: <p>Renamed from {event.before}</p> };
}

function bedsRow(event: BedsEvent): RowWords {
  return {
    label: "Register",
    body: (
      <p>
        Registered beds <Change before={event.before ?? "not stated"} after={event.after ?? "not stated"} />
      </p>
    ),
  };
}

function conditionAddedRow(event: ConditionAddedEvent): RowWords {
  return {
    label: "Register",
    body: <p>Condition {event.condition_number} added</p>,
    words: <ConditionWords number={event.condition_number} text={event.text} />,
  };
}

function conditionChangedRow(event: ConditionChangedEvent): RowWords {
  return {
    label: "Register",
    body: <p>Condition {event.condition_number} changed</p>,
    words: (
      <ConditionWords number={event.condition_number} text={event.after}>
        <p className={mutedClass}>Before the change:</p>
        <blockquote className="leading-relaxed text-ink-muted">“{event.before}”</blockquote>
      </ConditionWords>
    ),
  };
}

function conditionRemovedRow(event: ConditionRemovedEvent): RowWords {
  return {
    label: "Register",
    body: <p>Condition {event.condition_number} no longer on the register</p>,
    words: <ConditionWords number={event.condition_number} text={event.text} />,
  };
}

function noteAddedRow(event: NoteAddedEvent): RowWords {
  return {
    label: "Register",
    body: <p>Chief Inspector&apos;s note</p>,
    words: <blockquote className="leading-relaxed">“{event.text}”</blockquote>,
  };
}

function noteRemovedRow(): RowWords {
  return { label: "Register", body: <p>Chief Inspector&apos;s note no longer on the register</p> };
}

function priceRow(event: PriceEvent): RowWords {
  return {
    label: "Price",
    body: (
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span>
          Fair Deal weekly price <Change before={formatWeeklyPrice(event.before)} after={formatWeeklyPrice(event.after)} />
        </span>
        <span className={mutedClass}>{priceDifference(event.before, event.after, formatWeeklyPrice)}</span>
      </p>
    ),
  };
}

// "50 → 47", read out as "50 to 47", and kept on one line.
function Change({ before, after }: { before: ReactNode; after: ReactNode }) {
  return (
    <span className="whitespace-nowrap">
      {before} <span aria-hidden>→</span>
      <span className="sr-only">to</span> {after}
    </span>
  );
}

// A condition in HIQA's words: its first two lines, and all of it once opened.
function ConditionWords({ number, text, children }: { number: number; text: string; children?: ReactNode }) {
  return (
    <div className={wordsGroupClass}>
      <ClampedWords text={text} />
      <WordsToggle what={`condition ${number}`}>{children}</WordsToggle>
    </div>
  );
}

type ReportEvent = InspectionEvent | ThematicInspectionEvent | UnreadReportEvent;

// "Report · 13 May 2026": the report itself, and the day HIQA published it. No page of ours shows
// one inspection's findings on their own, so the link goes to HIQA's file. The rows' links would all
// read the same to a screen reader, which hears "HIQA's report of the inspection on 15 Jan 2026,
// published 13 May 2026". A report HIQA no longer has online links to an email asking HIQA for it
// instead (CCARE-236).
function ReportLink({ event }: { event: ReportEvent }) {
  if (event.kind !== "unread_report" && event.requestHref) return <ReportRequest event={event} href={event.requestHref} />;
  return (
    // A link can't be followed on paper, where this is the published date, if it has one.
    // Smaller than the findings above it (CCARE-258), as the note about older reports beside it is: the
    // source, not the news.
    <a href={event.report_url} className={`shrink-0 text-sm ${rowLinkClass} ${event.published_date ? "" : "print:hidden"}`}>
      {/* One box, so the words keep their spaces where tap-target-top makes the link a flex
          container. */}
      <span className="whitespace-nowrap">
        <span className="sr-only">HIQA&apos;s </span>
        Report
        <span className="sr-only">
          {event.date && ` of the inspection on ${formatDate(event.date)}`}
          {event.date && event.published_date && ","}
          {event.published_date && " published"}
        </span>
        {/* Beside the inspection's date, a second date would read as another inspection's, so the
            published date is said only on paper, where the link can't be followed (CCARE-258). */}
        {event.published_date && (
          <span className="hidden print:inline">
            {" "}
            <span aria-hidden>·</span> <time dateTime={event.published_date}>{formatDate(event.published_date)}</time>
          </span>
        )}
        <span className="ml-1.5 inline-block align-middle print:hidden">
          <ExternalIcon />
        </span>
      </span>
    </a>
  );
}

// HIQA keeps three years of reports online and sends older ones on request, by email, as the home's
// page on hiqa.ie says. What was read from the report stays in the row; this says where the report
// itself can still be had. On paper, where the email can't be opened, it says only that.
function ReportRequest({ event, href }: { event: InspectionEvent | ThematicInspectionEvent; href: string }) {
  return (
    <p className={`shrink-0 ${mutedClass}`}>
      No longer on hiqa.ie
      <span className="print:hidden">
        {" "}
        <span aria-hidden>·</span>{" "}
        <a href={href} className={rowLinkClass}>
          Ask HIQA for it
          <span className="sr-only">{event.date ? `: the report of the inspection on ${formatDate(event.date)}` : ": the report"}</span>
        </a>
      </span>
    </p>
  );
}

// Each kind of thing's picture on the line: a magnifier for an inspection, as for what the inspector
// found on What happened next, a calendar for a registration, the register's card for a change to it,
// and the euro for a price.
function rowIcon(kind: CentreEvent["kind"]): IconName {
  switch (kind) {
    case "inspection":
    case "thematic_inspection":
    case "unread_report":
      return "search";
    case "registration":
      return "calendar";
    case "price":
      return "cost";
    default:
      return "id";
  }
}

// One thing that happened, as a step down a timeline (CCARE-258), as the stories on What happened next
// are told: its picture in a dot on a line that runs down to the next thing in the year, then the kind
// of thing with its date, then what changed. It was a row of three columns, date, kind and change; in
// user testing (P2_1) the participant struggled to find what the latest inspection found, so the
// latest has its dot filled and says "Latest inspection". Things of one day share its date: the date
// shows once, and is still there for a screen reader.
function Row({
  date,
  showsDate,
  label,
  icon,
  latest,
  last,
  link,
  children,
}: {
  date: ISODate | null;
  showsDate: boolean;
  label: string;
  icon: IconName;
  latest: boolean;
  last: boolean;
  link?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="relative flex gap-3 sm:gap-4">
      {/* The line down to the next thing in the year. */}
      {!last && <span aria-hidden className="absolute top-8 bottom-0 left-[0.9375rem] w-px bg-line" />}
      <span
        aria-hidden
        className={`relative grid size-8 shrink-0 place-items-center rounded-full border ${
          latest ? "border-primary bg-primary text-on-primary" : "border-line bg-surface text-ink-muted"
        }`}
      >
        <Icon name={icon} className="size-4" />
      </span>
      <div className={`flex min-w-0 flex-1 flex-col gap-1.5 pt-1 ${last ? "" : "pb-5"}`}>
        {/* The kind of thing, then its date beside it, as each step on What happened next has
            (CCARE-258). */}
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="font-semibold">{label}</span>
          {date && (
            <time dateTime={date} className={showsDate ? "text-sm text-ink-muted" : "sr-only"}>
              {formatDayOfYear(date)}
            </time>
          )}
          {/* The report beside the date, so it is plainly this inspection's (CCARE-258). */}
          {link && (
            <span className="inline-flex items-baseline gap-x-2.5 text-sm">
              {/* Not on a phone, where the link often wraps to a line of its own and the dot would start
                  it. */}
              <span aria-hidden className="hidden text-ink-muted sm:inline">
                ·
              </span>
              {link}
            </span>
          )}
          {latest && (
            <span className="rounded-full bg-tint-blue px-2.5 py-0.5 text-xs font-semibold text-on-tint-blue adult:rounded-md adult:border adult:border-line">
              Latest inspection
            </span>
          )}
        </p>
        <div className="flex min-w-0 flex-col gap-0.5">{children}</div>
      </div>
    </li>
  );
}

// latest: the latest inspection's event, whose row says so. One line runs down the whole timeline,
// through the years, from the first thing to the last (CCARE-258): each year's heading sits in the
// words' column, beside the line, and carries the line on to its first thing.
function Years({ years, reports, latest }: { years: TimelineYear[]; reports?: ReportsRead; latest?: CentreEvent }) {
  return years.map(({ year, rows }, yearIndex) => (
    <div key={year} className="flex flex-col">
      <h4 className={`relative pb-3 pl-11 font-heading text-2xl font-semibold text-ink sm:pl-12 ${yearIndex === 0 ? "pt-2" : "pt-1"}`}>
        {yearIndex > 0 && <span aria-hidden className="absolute top-0 bottom-0 left-[0.9375rem] w-px bg-line" />}
        {year}
      </h4>
      <ol>
        {rows.map(({ event, showsDate }, index) => {
          const { label, body, words, link } = rowWords(event, reports);
          return (
            <Row
              key={index}
              date={event.date}
              showsDate={showsDate}
              label={label}
              icon={rowIcon(event.kind)}
              latest={event === latest}
              last={yearIndex === years.length - 1 && index === rows.length - 1}
              link={link}
            >
              {body}
              {words}
            </Row>
          );
        })}
      </ol>
    </div>
  ));
}

// "2022–2024", for the fold's label; the years come newest first.
function yearRange(years: TimelineYear[]) {
  const newest = years[0].year;
  const oldest = years[years.length - 1].year;
  return newest === oldest ? `${newest}` : `${oldest}–${newest}`;
}

const REGISTER_CHANGES_DATED_BY_THE_REGISTER: CentreEvent["kind"][] = [
  "provider",
  "name",
  "beds",
  "condition_added",
  "condition_changed",
  "condition_removed",
  "note_added",
  "note_removed",
];

// updated: when ClearCare last downloaded HIQA's register, from which the register's changes come, if
// known; said under the timeline (CCARE-258).
export function Timeline({ events, reports, updated }: { events: CentreEvent[]; reports?: ReportsRead; updated?: ISODate }) {
  const { shown, folded } = foldOlderYears(rowsByYear(events));
  const foldedRows = folded.reduce((count, year) => count + year.rows.length, 0);
  // The latest inspection: the first one down the timeline, which runs newest first.
  const latest = [...shown, ...folded]
    .flatMap(({ rows }) => rows)
    .find(({ event }) => event.kind === "inspection" || event.kind === "thematic_inspection" || event.kind === "unread_report")?.event;
  // Each of the notes is said once, here, and only of a timeline with a row it is about.
  const hasRegisterChange = events.some((event) => REGISTER_CHANGES_DATED_BY_THE_REGISTER.includes(event.kind));

  return (
    <div>
      {/* For screen readers only (CCARE-258): on screen the years and dates say what this is. */}
      <h3 className="sr-only">What has happened at this home</h3>
      <Years years={shown} reports={reports} latest={latest} />
      {/* The older years, closed until opened: the same <details> as the site's other folds, with no
          script, and print opens it (globals.css). "group/section" keeps Show and Hide to it, apart
          from the conditions' own <details> inside. */}
      {folded.length > 0 && (
        <details className="group/section mt-3 border-t border-line-soft">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="font-semibold">
              {foldedRows} earlier events, {yearRange(folded)}
            </span>
            <ShowHide group="section" className="print:hidden" />
          </summary>
          <Years years={folded} reports={reports} latest={latest} />
        </details>
      )}
      {/* Notes on the data, at the foot rather than over the first year (CCARE-258): how current the
          timeline is, as the home page's example says it (sample-centre.tsx), and, where the timeline
          has one, how a change on the register is dated. The register doesn't say when a change
          happened, so it is dated by when we first saw it (ADR-0031); a registration has its own date. */}
      {(updated || hasRegisterChange) && (
        <div className="mt-5 flex flex-col gap-1 border-t border-line-soft pt-4 text-sm text-ink-muted">
          {updated && (
            <p>
              ClearCare last updated its data on <time dateTime={updated}>{formatDate(updated)}</time>
            </p>
          )}
          {hasRegisterChange && (
            <p>
              Changes to HIQA&apos;s register are dated by when ClearCare first saw them, which may be later than the
              change itself.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
