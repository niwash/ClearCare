// components/centre/timeline.tsx
// What has happened at a home, in order (CCARE-235): its inspections, the changes to its entry on
// HIQA's register and the changes of its contract price, one short row each, so a family sees the
// home's story without opening each report. A row says the date, what kind of thing it is and what
// changed, in the fewest words and marks, and does not repeat the report: an inspection's row names
// the regulations judged not compliant, or counts them when they are many, and counts the rest. The
// API sends an event as a kind and its fields (ADR-0033); every word a reader sees for one is
// written here, once, in the function of its kind; the overview's recent changes
// (recent-changes.tsx) are built from the same functions.
import { ShowHide } from "@/components/ui/chevron";
import { ExternalIcon } from "@/components/ui/external-icon";
import {
  formatDate,
  formatDayOfYear,
  formatWeeklyPrice,
  trailAnchor,
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
import { JUDGEMENT_LABELS, JudgementIcon } from "./judgement-icon";
import { ClampedWords, WordsToggle, wordsGroupClass } from "./register-words";

// What a row says: the kind of thing it is, then what changed. words: HIQA's own words for the
// change, a condition's or the note's, apart from ours so that a page that already quotes them can
// leave them out.
type RowWords = { label: string; body: ReactNode; words?: ReactNode };

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
    label: "Inspection",
    body: (
      <ReportRow event={event}>
        {/* A screen reader hears "Not compliant: Premises", or "12 not compliant", then
            "4 substantially compliant", "5 compliant". */}
        <ul className={judgedClass}>
          {named.map(({ regulation, trail }) => (
            // The mark and the title side by side, so a long title wraps beside its mark and never
            // leaves it alone on a line.
            <li key={regulation.number} className="flex items-baseline font-medium">
              <Mark judgement="not-compliant" />
              <span className="sr-only">{JUDGEMENT_LABELS["not-compliant"]}: </span>
              {trail ? (
                // The link the finding's cell has in the grid of judgments (lib/judgements.ts). In the
                // ink colour, as the titles without a trail are: the underline says it is a link.
                <a href={`${reports?.trailsHref}#${trailAnchor(trail.regulation)}`} className={`text-ink ${rowLinkClass}`}>
                  {regulation.title}
                </a>
              ) : (
                regulation.title
              )}
            </li>
          ))}
          {notCompliant.length > named.length && (
            // In the titles' place and as they are: it is the row's main fact.
            <li className="whitespace-nowrap font-medium">
              <Mark judgement="not-compliant" />
              {notCompliant.length} {JUDGEMENT_LABELS["not-compliant"].toLowerCase()}
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
      </ReportRow>
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
    label: "Thematic inspection",
    body: (
      <ReportRow event={event}>
        <p className={judgedClass}>
          {event.overall_judgment} overall
          {notice && <span className={mutedClass}>{notice}</span>}
        </p>
      </ReportRow>
    ),
  };
}

// A report HIQA lists that ClearCare holds no reading of: the row says it exists and where it is.
// With no reading there is no type of inspection, so the row says the notice isn't known.
function unreadReportRow(event: UnreadReportEvent): RowWords {
  return {
    label: "Inspection",
    body: (
      <ReportRow event={event}>
        <p className={mutedClass}>{noticeWords(null)}</p>
      </ReportRow>
    ),
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

// A row about a report: what it says, then the link to the report. The link is at the right end of
// the line on a wide screen, level with the last line when the words before it wrap. Under them on
// a phone or a tablet, where a column kept for the link would leave the titles a third of the row.
function ReportRow({ event, children }: { event: ReportEvent; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-x-6 gap-y-2 lg:flex-row lg:items-baseline-last lg:justify-between">
      {children}
      <ReportLink event={event} />
    </div>
  );
}

type ReportEvent = InspectionEvent | ThematicInspectionEvent | UnreadReportEvent;

// "Report · 13 May 2026": the report itself, and the day HIQA published it. No page of ours shows
// one inspection's findings on their own, so the link goes to HIQA's file. Reports read in October
// 2026 that HIQA has since taken off its pages have no published date. The rows' links would all
// read the same to a screen reader, which hears "HIQA's report of the inspection on 15 Jan 2026,
// published 13 May 2026".
function ReportLink({ event }: { event: ReportEvent }) {
  return (
    // A link can't be followed on paper, where this is the published date, if it has one.
    <a href={event.report_url} className={`shrink-0 ${rowLinkClass} ${event.published_date ? "" : "print:hidden"}`}>
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
        {event.published_date && (
          <>
            {" "}
            <span aria-hidden>·</span> <time dateTime={event.published_date}>{formatDate(event.published_date)}</time>
          </>
        )}
        <span className="ml-1.5 inline-block align-middle print:hidden">
          <ExternalIcon />
        </span>
      </span>
    </a>
  );
}

// A row in three columns: the date, the kind of thing, what changed. On a phone the last two share
// the second column, one over the other. Rows of one day share its date and sit closer together,
// with no line between them; the date is still there for a screen reader.
function Row({ date, showsDate, label, children }: { date: ISODate | null; showsDate: boolean; label: string; children: ReactNode }) {
  const sharesDay = date !== null && !showsDate;
  return (
    <li
      className={`grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 pb-3 sm:grid-cols-[3.5rem_9.5rem_minmax(0,1fr)] sm:gap-x-4 ${
        sharesDay ? "" : "border-t border-line-soft pt-3 first:border-t-0"
      }`}
    >
      <div className="font-mono text-sm leading-6 text-ink">
        {date && (
          <time dateTime={date} className={showsDate ? "" : "sr-only"}>
            {formatDayOfYear(date)}
          </time>
        )}
      </div>
      <p className="font-semibold">{label}</p>
      <div className="col-start-2 flex min-w-0 flex-col gap-0.5 sm:col-start-3">{children}</div>
    </li>
  );
}

function Years({ years, reports }: { years: TimelineYear[]; reports?: ReportsRead }) {
  return years.map(({ year, rows }) => (
    <div key={year} className="mt-5 flex flex-col gap-1">
      <h4 className="font-heading text-lg font-semibold">{year}</h4>
      <ol>
        {rows.map(({ event, showsDate }, index) => {
          const { label, body, words } = rowWords(event, reports);
          return (
            <Row key={index} date={event.date} showsDate={showsDate} label={label}>
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

export function Timeline({ events, reports }: { events: CentreEvent[]; reports?: ReportsRead }) {
  const { shown, folded } = foldOlderYears(rowsByYear(events));
  const foldedRows = folded.reduce((count, year) => count + year.rows.length, 0);
  // Each of the notes is said once, here, and only of a timeline with a row it is about.
  const hasInspection = events.some((event) => event.kind === "inspection" || event.kind === "thematic_inspection");
  const hasRegisterChange = events.some((event) => REGISTER_CHANGES_DATED_BY_THE_REGISTER.includes(event.kind));

  return (
    <div>
      <h3 className="font-semibold">What has happened at this home</h3>
      {(hasInspection || hasRegisterChange) && (
        <p className={`mt-1 ${mutedClass}`}>
          {hasInspection && "Inspections are without notice unless a row says otherwise. "}
          {/* The register doesn't say when a change happened (ADR-0031). */}
          {hasRegisterChange &&
            "A change on HIQA’s register, other than a registration, is dated by the day the register first showed it."}
        </p>
      )}
      <Years years={shown} reports={reports} />
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
          <Years years={folded} reports={reports} />
        </details>
      )}
    </div>
  );
}
